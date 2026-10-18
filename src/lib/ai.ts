// Free AI layer: talks to a local Ollama server (or any OpenAI-compatible server such as LM Studio).
// The model only ever sees sources from our own library and must cite them by number;
// citations are checked against those sources before anything is shown.
import type { Lang } from './data';
import { hitForPrompt, hitGrade } from './format';
import { isAcceptable } from './grades';
import { search, type Hit } from './search';
import type { AiSettings } from './store';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

/** Error message used when the AI server cannot be reached at all (not running, blocked, wrong address). */
export const AI_UNREACHABLE = 'AI_UNREACHABLE';

async function reach(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    // Browsers only say "Failed to fetch" for a server that is off, blocked by CORS or by local-network rules.
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw new Error(AI_UNREACHABLE);
  }
}

async function complete(ai: AiSettings, messages: Msg[], json = false): Promise<string> {
  const base = ai.baseUrl.replace(/\/$/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180_000);
  try {
    if (ai.provider === 'ollama') {
      const res = await reach(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ai.model,
          messages,
          stream: false,
          ...(json ? { format: 'json' } : {}),
          options: { temperature: 0.2 },
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.message?.content ?? '';
    }
    const res = await reach(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ai.apiKey ? { Authorization: `Bearer ${ai.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: ai.model,
        messages,
        temperature: 0.2,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`AI server error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

export async function testConnection(ai: AiSettings): Promise<string> {
  const base = ai.baseUrl.replace(/\/$/, '');
  const url = ai.provider === 'ollama' ? `${base}/api/tags` : `${base}/models`;
  const res = await reach(url, { headers: ai.apiKey ? { Authorization: `Bearer ${ai.apiKey}` } : {} });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const names: string[] = (data.models ?? data.data ?? []).map((m: { name?: string; id?: string }) => m.name ?? m.id ?? '');
  if (names.length && !names.some((n) => n === ai.model || n.startsWith(ai.model + ':') || ai.model.startsWith(n)))
    throw new Error(`Connected, but model "${ai.model}" is not installed. Installed: ${names.join(', ')}`);
  return names.join(', ');
}

function parseJson<T>(s: string): T | null {
  try {
    const m = s.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as T) : null;
  } catch {
    return null;
  }
}

/** Asks the model for search keywords in both languages (the library is bilingual). */
async function keywords(ai: AiSettings, text: string): Promise<string> {
  try {
    const out = await complete(
      ai,
      [
        {
          role: 'system',
          content:
            'You turn a question about Islam into search keywords for a library of Quran verses, hadith and duas. ' +
            'Reply ONLY with JSON: {"en": ["..."], "ar": ["..."]}. Give 2-5 short keywords in English and 2-5 in Arabic ' +
            '(no diacritics). Use words likely to appear in the actual texts (e.g. "debt", "دين", "رزق", "provision").',
        },
        { role: 'user', content: text },
      ],
      true,
    );
    const k = parseJson<{ en?: string[]; ar?: string[] }>(out);
    return [...(k?.en ?? []), ...(k?.ar ?? [])].filter((x) => typeof x === 'string').join(' ');
  } catch {
    return '';
  }
}

/** Retrieves a balanced set of sources: best ayat, duas and hadith. */
export async function retrieve(query: string, collections?: string[]): Promise<Hit[]> {
  const [q, d, h] = await Promise.all([
    search(query, { sources: ['quran'], mode: 'rank', limit: 3 }),
    search(query, { sources: ['hisn'], mode: 'rank', limit: 3 }),
    search(query, { sources: ['hadith'], collections, mode: 'rank', limit: 12 }),
  ]);
  // Prefer authentic hadith, but keep weak ones if they match far better (the user should see them graded).
  const hadith = [...h].sort((a, b) => b.score + (isAcceptable(hitGrade(b)!) ? 0.15 : 0) - (a.score + (isAcceptable(hitGrade(a)!) ? 0.15 : 0))).slice(0, 4);
  return [...q, ...d, ...hadith].filter((x) => x.score >= 0.34).sort((a, b) => b.score - a.score);
}

const RULES =
  'You are a careful assistant for Muslims. You MUST answer only using the numbered SOURCES provided. ' +
  'Cite every claim with its source number in square brackets, like [1] or [2][3]. ' +
  'Never quote a verse, hadith or dua that is not in the SOURCES, never invent references, narrators or gradings. ' +
  'When you mention a hadith, state its grading as given. If a source is graded weak (daif) or fabricated, say so clearly. ' +
  'If the SOURCES do not answer the question, say plainly that no source was found in the library and suggest asking a qualified scholar. ' +
  'Do not issue fatwas on personal rulings; refer those to scholars. Keep answers short and clear.';

export type AskResult = { answer: string; sources: Hit[]; cited: number[] };

export async function ask(ai: AiSettings, question: string, lang: Lang, history: Msg[] = []): Promise<AskResult> {
  const kw = await keywords(ai, question);
  const sources = await retrieve(`${question} ${kw}`);
  const block = sources.map((s, i) => hitForPrompt(s, i + 1)).join('\n\n') || '(no sources found)';
  const answer = await complete(ai, [
    { role: 'system', content: RULES + (lang === 'ar' ? ' Answer in Arabic.' : ' Answer in English.') },
    ...history.slice(-6),
    { role: 'user', content: `SOURCES:\n${block}\n\nQUESTION: ${question}` },
  ]);
  return checkCitations(answer, sources);
}

/** Removes citation numbers that do not exist and reports which sources were really cited. */
export function checkCitations(answer: string, sources: Hit[]): AskResult {
  const cited = new Set<number>();
  const clean = answer.replace(/\[(\d+)\]/g, (m, n) => {
    const i = Number(n);
    if (i >= 1 && i <= sources.length) {
      cited.add(i);
      return m;
    }
    return '';
  });
  return { answer: clean.trim(), sources, cited: [...cited].sort((a, b) => a - b) };
}

export type Verdict = 'found' | 'weak' | 'partial' | 'not_found';
export type VerifyResult = { verdict: Verdict; matches: Hit[]; explanation?: string; cited?: number[] };

/** Rule-based verdict from the best library matches (works without AI). */
export function ruleVerdict(matches: Hit[]): Verdict {
  const top = matches[0];
  if (!top || top.score < 0.45) return 'not_found';
  const strong = matches.filter((m) => m.score >= 0.75);
  if (strong.length === 0) return 'partial';
  if (strong.some((m) => m.kind !== 'hadith' || isAcceptable(hitGrade(m)!))) return 'found';
  return 'weak';
}

export async function verify(claim: string, lang: Lang, ai: AiSettings | null): Promise<VerifyResult> {
  const kw = ai ? await keywords(ai, claim) : '';
  const matches = (await retrieve(kw ? `${claim} ${kw}` : claim)).slice(0, 6);
  const fallback = ruleVerdict(matches);
  if (!ai) return { verdict: fallback, matches };
  const block = matches.map((s, i) => hitForPrompt(s, i + 1)).join('\n\n') || '(no sources found)';
  const out = await complete(
    ai,
    [
      {
        role: 'system',
        content:
          RULES +
          ' Your task: check a CLAIM someone heard (for example in a lecture) against the SOURCES. Reply ONLY with JSON: ' +
          '{"verdict": "found" | "weak" | "partial" | "not_found", "sources": [numbers], "explanation": "..."}. ' +
          '"found" = the claim matches an authentic source (Quran, Hisn al-Muslim, or a sahih/hasan hadith). ' +
          '"weak" = it only matches a hadith graded weak or fabricated. ' +
          '"partial" = the text exists but part of the claim (a promised reward, number of repetitions, specific benefit) is NOT in the sources. ' +
          '"not_found" = nothing in the SOURCES matches. Cite source numbers in the explanation like [1]. ' +
          (lang === 'ar' ? 'Write the explanation in Arabic.' : 'Write the explanation in English.'),
      },
      { role: 'user', content: `SOURCES:\n${block}\n\nCLAIM: ${claim}` },
    ],
    true,
  );
  const r = parseJson<{ verdict?: string; sources?: number[]; explanation?: string }>(out);
  const checked = checkCitations(r?.explanation ?? '', matches);
  const valid = (r?.sources ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= matches.length);
  let verdict = (['found', 'weak', 'partial', 'not_found'] as const).find((v) => v === r?.verdict) ?? fallback;
  // The model may not claim a source exists without citing one that really does.
  if (verdict !== 'not_found' && valid.length === 0 && checked.cited.length === 0) verdict = fallback;
  return { verdict, matches, explanation: checked.answer, cited: [...new Set([...valid, ...checked.cited])].sort((a, b) => a - b) };
}

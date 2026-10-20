// AI layer: a local Ollama server, or any OpenAI-compatible server (LM Studio, or free cloud tiers such as Groq).
// The model only ever sees sources from our own library and must cite them by number;
// citations are checked against those sources before anything is shown.
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import { claudeComplete, claudeModels, CLAUDE_DEFAULT_MODEL } from './claude';
import type { Lang } from './data';
import { hitForPrompt, hitGrade } from './format';
import { isAcceptable } from './grades';
import { search, type Hit } from './search';
import { normalize } from './text';
import type { AiSettings } from './store';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

// Error codes shown to the user as step-by-step help (see aiError_* strings in i18n.ts).
export const AI_ERRORS = ['AI_UNREACHABLE', 'AI_PHONE_LOCALHOST', 'AI_BLOCKED_BY_SITE', 'AI_BAD_KEY', 'AI_RATE_LIMIT', 'AI_REFUSED'] as const;

const isLocalhost = (url: string) => /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(url);

async function timeoutFetch(url: string, ms: number, init?: RequestInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** fetch() that turns network failures into an explanation of the likely cause. */
async function reach(ai: AiSettings, url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    // On a phone, "localhost" is the phone itself, not the computer running Ollama.
    if (Platform.OS !== 'web' && isLocalhost(ai.baseUrl)) throw new Error('AI_PHONE_LOCALHOST');
    if (Platform.OS === 'web') {
      // An opaque (no-cors) request succeeds if the server is up, so a failure above means it blocked this site.
      const up = await timeoutFetch(ai.baseUrl, 3000, { mode: 'no-cors' }).then(
        () => true,
        () => false,
      );
      if (up) throw new Error('AI_BLOCKED_BY_SITE');
    }
    throw new Error('AI_UNREACHABLE');
  }
  if (res.status === 401 || res.status === 403) throw new Error('AI_BAD_KEY');
  return res;
}

/** `json`: true for any JSON reply, or a JSON schema the reply must follow. */
async function complete(ai: AiSettings, messages: Msg[], json: boolean | Record<string, unknown> = false): Promise<string> {
  if (ai.provider === 'anthropic') return claudeComplete(ai.apiKey, ai.model, messages, typeof json === 'object' ? json : undefined);
  const base = ai.baseUrl.replace(/\/$/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180_000);
  try {
    if (ai.provider === 'ollama') {
      const res = await reach(ai, `${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ai.model,
          messages,
          stream: false,
          ...(json ? { format: typeof json === 'object' ? json : 'json' } : {}),
          // Ollama's default context is small; the numbered sources need room or they are silently cut off.
          options: { temperature: 0.2, num_ctx: 8192 },
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.message?.content ?? '';
    }
    const send = (withJson: boolean) =>
      reach(ai, `${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ai.apiKey ? { Authorization: `Bearer ${ai.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: ai.model,
          messages,
          temperature: 0.2,
          ...(withJson ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: ctrl.signal,
      });
    let res = await send(!!json);
    // Not every model supports JSON mode; the answer is parsed leniently anyway.
    if (!res.ok && json && res.status === 400) res = await send(false);
    if (!res.ok) throw new Error(`AI server error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

/** Connects to the server and returns the names of the models it offers. */
export async function testConnection(ai: AiSettings): Promise<string[]> {
  if (ai.provider === 'anthropic') return claudeModels(ai.apiKey);
  const base = ai.baseUrl.replace(/\/$/, '');
  const url = ai.provider === 'ollama' ? `${base}/api/tags` : `${base}/models`;
  const res = await reach(ai, url, { headers: ai.apiKey ? { Authorization: `Bearer ${ai.apiKey}` } : {} });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const names: string[] = (data.models ?? data.data ?? [])
    .map((m: { name?: string; id?: string }) => (m.id ?? m.name ?? '').replace(/^models\//, ''))
    .filter(Boolean);
  return names;
}

/** Looks for an Ollama server on the same Wi-Fi as this phone (it must be started with OLLAMA_HOST=0.0.0.0). */
export async function findOllamaOnWifi(onProgress?: (done: number, total: number) => void): Promise<string | null> {
  const ip = await Network.getIpAddressAsync().catch(() => '');
  const m = ip.match(/^(\d+\.\d+\.\d+)\.(\d+)$/);
  if (!m || ip === '0.0.0.0') return null;
  const hosts = Array.from({ length: 254 }, (_, i) => `${m[1]}.${i + 1}`).filter((h) => h !== ip);
  let done = 0;
  let found: string | null = null;
  const queue = [...hosts];
  const worker = async () => {
    while (queue.length && !found) {
      const host = queue.shift()!;
      const ok = await timeoutFetch(`http://${host}:11434/api/tags`, 1500).then(
        (r) => r.ok,
        () => false,
      );
      if (ok && !found) found = `http://${host}:11434`;
      onProgress?.(++done, hosts.length);
    }
  };
  await Promise.all(Array.from({ length: 32 }, worker));
  return found;
}

export type AiPreset = {
  id: string;
  label: string;
  provider: AiSettings['provider'];
  baseUrl: string;
  keyUrl?: string;
  cloud?: boolean;
  native?: boolean; // only offered in the phone app
  freeModels?: (name: string) => boolean;
  defaultModel?: string;
};

const KEYWORDS_SCHEMA = {
  type: 'object',
  properties: { en: { type: 'array', items: { type: 'string' } }, ar: { type: 'array', items: { type: 'string' } } },
  required: ['en', 'ar'],
  additionalProperties: false,
};
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['found', 'weak', 'partial', 'not_found'] },
    sources: { type: 'array', items: { type: 'integer' } },
    explanation: { type: 'string' },
  },
  required: ['verdict', 'sources', 'explanation'],
  additionalProperties: false,
};

export const AI_PRESETS: AiPreset[] = [
  { id: 'ollama-local', label: 'Ollama (this computer)', provider: 'ollama', baseUrl: 'http://localhost:11434' },
  { id: 'ollama-wifi', label: 'Ollama (computer on my Wi-Fi)', provider: 'ollama', baseUrl: '', native: true },
  { id: 'groq', label: 'Groq (free key)', provider: 'openai', baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', cloud: true },
  { id: 'gemini', label: 'Google Gemini (free key)', provider: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey', cloud: true, freeModels: (n) => /flash/i.test(n) },
  { id: 'openrouter', label: 'OpenRouter (free models)', provider: 'openai', baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', cloud: true, freeModels: (n) => n.endsWith(':free') },
  { id: 'claude', label: 'Claude (Anthropic API key)', provider: 'anthropic', baseUrl: 'https://api.anthropic.com', keyUrl: 'https://platform.claude.com/settings/keys', cloud: true, defaultModel: CLAUDE_DEFAULT_MODEL, freeModels: (n) => n.startsWith('claude-') },
  { id: 'lmstudio', label: 'LM Studio', provider: 'openai', baseUrl: 'http://localhost:1234/v1' },
];

function parseJson<T>(s: string): T | null {
  try {
    const m = s.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Asks the model for search keywords in both languages (the library is bilingual).
 * `context` is the previous question, so follow-ups like "and what does it say?" still find the right texts.
 */
async function keywords(ai: AiSettings, text: string, context?: string): Promise<string> {
  try {
    const out = await complete(
      ai,
      [
        {
          role: 'system',
          content:
            'You turn a question about Islam into search keywords for a library of Quran verses (Arabic + English translation), ' +
            'hadith (Arabic + English) and duas (Arabic). Reply ONLY with JSON: {"en": ["..."], "ar": ["..."]}. ' +
            'Give 3-6 keywords in English and 3-6 in Arabic: the specific things, people, places, acts and names the question is about, ' +
            'as single words in their basic form (singular, Arabic without "ال" and without diacritics), plus close synonyms and the words ' +
            'the texts themselves would use. Example: "which ayah mentions the dog of the people of the cave?" -> ' +
            '{"en": ["dog", "cave", "sleepers"], "ar": ["كلب", "كهف", "رقيم"]}. ' +
            'Never use generic words like Quran, ayah, verse, hadith, Allah, Prophet, Islam, mention.',
        },
        { role: 'user', content: context ? `Earlier question: ${context}\nQuestion: ${text}` : text },
      ],
      KEYWORDS_SCHEMA,
    );
    const k = parseJson<{ en?: unknown; ar?: unknown }>(out);
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((w): w is string => typeof w === 'string') : []);
    return [...list(k?.en), ...list(k?.ar)].join(' ');
  } catch {
    return '';
  }
}

// What the question asks for decides how many results each part of the library gets.
// (Arabic words are matched between spaces, with an optional و/ب/ال in front; normalize() pads the text with spaces.)
const ar = (words: string) => new RegExp(` (?:و|ف|ب)?(?:ال)?(?:${words}) `);
const WANTS_QURAN = [/\b(quran|koran|qur|ayah?|ayat|ayahs|verses?|surah?|suras?|surahs|chapter)\b/, ar('قران|ايه|ايات|سوره|سور|مصحف')];
const WANTS_HADITH = [/\b(hadiths?|ahadith|sunnah?|narrated|narration|bukhari|tirmidhi|dawud|majah|nasai)\b/, ar('حديث|احاديث|سنه|نبي|رسول')];
const WANTS_DUA = [/\b(duas?|duaa|supplications?|dhikr|adhkar|azkar|invocations?)\b/, ar('دعاء|ادعيه|اذكار')];
const wants = (q: string, res: RegExp[]) => res.some((r) => r.test(q));

/**
 * Retrieves a balanced set of sources: the best ayat, duas and hadith for a question.
 * `boost` holds extra search words (the AI's keywords); they count double, so the texts about the actual
 * subject ("dog", "كلب") rank above texts that only share the question's wording.
 */
export async function retrieve(question: string, opts: { boost?: string; collections?: string[] } = {}): Promise<Hit[]> {
  const q = normalize(question);
  const want: Hit['kind'] | null = wants(q, WANTS_QURAN) ? 'quran' : wants(q, WANTS_HADITH) ? 'hadith' : wants(q, WANTS_DUA) ? 'hisn' : null;
  const slots =
    want === 'quran'
      ? { quran: 8, hisn: 2, hadith: 2 }
      : want === 'hadith'
        ? { quran: 3, hisn: 2, hadith: 7 }
        : want === 'hisn'
          ? { quran: 3, hisn: 5, hadith: 3 }
          : { quran: 4, hisn: 3, hadith: 4 };
  const base = { mode: 'rank' as const, boost: opts.boost };
  const [quran, hisn, hadith] = await Promise.all([
    search(question, { ...base, sources: ['quran'], limit: slots.quran }),
    search(question, { ...base, sources: ['hisn'], limit: slots.hisn }),
    search(question, { ...base, sources: ['hadith'], collections: opts.collections, limit: 30 }),
  ]);
  // Prefer authentic hadith, but keep weak ones if they match far better (the user should see them graded).
  const bonus = (h: Hit) => h.score + (isAcceptable(hitGrade(h)!) ? 0.15 : 0);
  const hadithBest = [...hadith].sort((a, b) => bonus(b) - bonus(a)).slice(0, slots.hadith);
  // Keep a result only when it matches a fair part of the question, and not far less than the best one of its kind.
  const good = (hits: Hit[]) => {
    const top = Math.max(0, ...hits.map((h) => h.score));
    return hits.filter((h) => h.score >= 0.25 && h.score >= top * 0.45);
  };
  // What was asked for comes first (ayat for "which ayah…"), then the best matches.
  return [...good(quran), ...good(hisn), ...good(hadithBest)].sort((a, b) => Number(b.kind === want) - Number(a.kind === want) || b.score - a.score);
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
  const previous = [...history].reverse().find((m) => m.role === 'user')?.content;
  const sources = await retrieve(question, { boost: await keywords(ai, question, previous) });
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
  const top = Math.max(0, ...matches.map((m) => m.score));
  if (top < 0.45) return 'not_found';
  const strong = matches.filter((m) => m.score >= 0.75);
  if (strong.length === 0) return 'partial';
  if (strong.some((m) => m.kind !== 'hadith' || isAcceptable(hitGrade(m)!))) return 'found';
  return 'weak';
}

export async function verify(claim: string, lang: Lang, ai: AiSettings | null): Promise<VerifyResult> {
  // The rule-based verdict measures how much of the claim itself is in the library, so it ignores the AI keywords.
  const direct = await retrieve(claim);
  const fallback = ruleVerdict(direct);
  if (!ai) return { verdict: fallback, matches: direct };
  const matches = await retrieve(claim, { boost: await keywords(ai, claim) });
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
    VERDICT_SCHEMA,
  );
  const r = parseJson<{ verdict?: string; sources?: number[]; explanation?: string }>(out);
  const checked = checkCitations(r?.explanation ?? '', matches);
  const valid = (r?.sources ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= matches.length);
  let verdict = (['found', 'weak', 'partial', 'not_found'] as const).find((v) => v === r?.verdict) ?? fallback;
  // The model may not claim a source exists without citing one that really does.
  if (verdict !== 'not_found' && valid.length === 0 && checked.cited.length === 0) verdict = fallback;
  return { verdict, matches, explanation: checked.answer, cited: [...new Set([...valid, ...checked.cited])].sort((a, b) => a - b) };
}

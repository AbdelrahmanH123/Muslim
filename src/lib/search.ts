// Keyword search over the local library (Quran, Hisn al-Muslim, hadith collections).
import {
  COLLECTIONS,
  collectionInfo,
  loadCollection,
  loadHisn,
  loadQuran,
  type Ayah,
  type Hadith,
  type HisnChapter,
} from './data';
import { isQuestionWord, normalize, stem, terms } from './text';

export type Hit =
  | { kind: 'quran'; key: string; score: number; ayah: Ayah; surahName: { en: string; ar: string; tr: string } }
  | { kind: 'hadith'; key: string; score: number; hadith: Hadith }
  | { kind: 'hisn'; key: string; score: number; chapter: HisnChapter; index: number };

export type Source = 'quran' | 'hisn' | 'hadith';

export type SearchOptions = {
  sources?: Source[];
  /** Hadith collections to search; defaults to all. */
  collections?: string[];
  /** 'all' = every term must appear (normal search); 'rank' = best partial matches (AI and verification). */
  mode?: 'all' | 'rank';
  limit?: number;
  /** Rank mode only: extra search words (e.g. AI keywords) that count double. */
  boost?: string;
};

type Doc = { norm: string; make: (score: number) => Hit };

const corpusCache = new Map<string, Promise<Doc[]>>();
function corpus(sources: Source[], collections: string[]): Promise<Doc[]> {
  const key = `${[...sources].sort()}|${sources.includes('hadith') ? [...collections].sort() : ''}`;
  let docs = corpusCache.get(key);
  if (!docs) {
    docs = buildCorpus(sources, collections);
    docs.catch(() => corpusCache.delete(key));
    corpusCache.set(key, docs);
  }
  return docs;
}

async function buildCorpus(sources: Source[], collections: string[]): Promise<Doc[]> {
  const docs: Doc[] = [];
  if (sources.includes('quran')) {
    const q = await loadQuran();
    for (const ayah of q.ayat) {
      const s = q.surahs[ayah.s - 1];
      docs.push({
        norm: ayah.norm,
        make: (score) => ({ kind: 'quran', key: `q:${ayah.s}:${ayah.a}`, score, ayah, surahName: s }),
      });
    }
  }
  if (sources.includes('hisn')) {
    const h = await loadHisn();
    for (const chapter of h.chapters) {
      if (chapter.id === 0) continue; // book introduction
      chapter.text.forEach((_, index) =>
        docs.push({
          norm: chapter.norm[index],
          make: (score) => ({ kind: 'hisn', key: `d:${chapter.id}:${index}`, score, chapter, index }),
        }),
      );
    }
  }
  if (sources.includes('hadith')) {
    const cols = await Promise.all(collections.map((id) => loadCollection(id)));
    for (const col of cols)
      for (const hadith of col.hadiths)
        docs.push({ norm: hadith.norm, make: (score) => ({ kind: 'hadith', key: `h:${col.id}:${hadith.n}`, score, hadith }) });
  }
  return docs;
}

export async function search(query: string, opts: SearchOptions = {}): Promise<Hit[]> {
  const sources = opts.sources ?? ['quran', 'hisn', 'hadith'];
  const collections = opts.collections ?? COLLECTIONS.map((c) => c.id);
  const mode = opts.mode ?? 'all';
  const limit = opts.limit ?? 200;
  const ref = parseReference(query);
  const ts = terms(query);
  if (ts.length === 0) return [];
  const docs = await corpus(sources, collections);
  const phrase = normalize(query);
  const hits: Hit[] = [];

  if (mode === 'all') {
    for (const d of docs) {
      if (!ts.every((t) => d.norm.includes(t))) continue;
      let score = 1;
      for (const t of ts) if (d.norm.includes(' ' + t + ' ')) score += 1; // whole-word bonus
      if (phrase.trim().length > 3 && d.norm.includes(phrase.trim())) score += 5;
      hits.push(d.make(score));
    }
  } else {
    // Word forms are loosened ("dogs" -> "dog", "الكلب" -> "كلب") and each term is weighted by how rare it is,
    // so specific words count more than common ones. Boosted words (the AI's keywords) count double.
    const weight = new Map<string, number>();
    const stripped = new Set<string>();
    const loosen = (t: string) => {
      const st = stem(t);
      if (st !== t && !/^[a-z]/.test(t)) stripped.add(st);
      return st;
    };
    const own = ts.map(loosen).filter((t) => !isQuestionWord(t));
    for (const t of own.length ? own : ts.map(stem)) weight.set(t, 1);
    for (const t of opts.boost ? terms(opts.boost) : []) weight.set(loosen(t), 2);
    // English words must start a word ("ant" finds "ants", not "servant"). An Arabic word whose article was removed
    // must start a word too, after at most و ف ب ل ك and the article ("نار" finds "النار", not "دينار").
    const rs = [...weight.keys()];
    const match = rs.map((t) =>
      /^[a-z0-9]/.test(t) ? (n: string) => n.includes(' ' + t) : stripped.has(t) ? (n: string) => n.includes(t) && arabicWordStart(t).test(n) : (n: string) => n.includes(t),
    );
    const df = match.map((m) => docs.reduce((n, d) => n + (m(d.norm) ? 1 : 0), 0));
    const w = rs.map((t, i) => weight.get(t)! * Math.log(1 + docs.length / (1 + df[i])));
    const total = w.reduce((a, b) => a + b, 0) || 1;
    for (const d of docs) {
      let s = 0;
      rs.forEach((t, i) => {
        if (!match[i](d.norm)) return;
        // A whole English word (or its plural) counts fully; only the start of a longer word ("been" for "bee") counts half.
        const latin = t[0] >= 'a' && t[0] <= 'z';
        s += !latin || d.norm.includes(` ${t} `) || d.norm.includes(` ${t}s `) || d.norm.includes(` ${t}es `) ? w[i] : w[i] / 2;
      });
      if (s === 0) continue;
      let score = s / total; // 0..1 share of the query matched
      if (phrase.trim().length > 6 && d.norm.includes(phrase.trim())) score = Math.max(score, 1);
      hits.push(d.make(score));
    }
  }
  hits.sort((a, b) => b.score - a.score || kindOrder(a) - kindOrder(b));
  const out = hits.slice(0, limit);
  if (ref) {
    const direct = await resolveReference(ref);
    if (direct && !out.some((h) => h.key === direct.key)) out.unshift(direct);
  }
  return out;
}

const arabicStart = new Map<string, RegExp>();
const arabicWordStart = (t: string) => {
  let re = arabicStart.get(t);
  if (!re) arabicStart.set(t, (re = new RegExp(` [وفبلك]{0,2}(?:ال)?${t}`)));
  return re;
};

const kindOrder = (h: Hit) => (h.kind === 'quran' ? 0 : h.kind === 'hisn' ? 1 : 2);

// "2:255", "Bukhari 6405", "muslim 2699", "Muslim 3033 b"
type Ref = { kind: 'quran'; s: number; a: number } | { kind: 'hadith'; col: string; n: string };
function parseReference(q: string): Ref | null {
  const m = q.trim().match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
  if (m) return { kind: 'quran', s: +m[1], a: +m[2] };
  const h = q.trim().toLowerCase().match(/^([a-z' -]+?)\s*#?\s*(\d+)\s*([a-z]{0,2})$/);
  if (h) {
    const name = h[1].replace(/[^a-z]/g, '');
    const col = COLLECTIONS.find((c) => name.length >= 4 && (c.id.startsWith(name) || name.startsWith(c.id)));
    if (col) return { kind: 'hadith', col: col.id, n: h[2] + h[3] };
  }
  return null;
}

async function resolveReference(ref: Ref): Promise<Hit | null> {
  if (ref.kind === 'quran') {
    const q = await loadQuran();
    const s = q.surahs[ref.s - 1];
    if (!s || ref.a < 1 || ref.a > s.count) return null;
    const ayah = q.ayat.find((x) => x.s === ref.s && x.a === ref.a)!;
    return { kind: 'quran', key: `q:${ref.s}:${ref.a}`, score: 99, ayah, surahName: s };
  }
  if (!collectionInfo(ref.col)) return null;
  const col = await loadCollection(ref.col);
  const hadith = col.byNumber.get(ref.n);
  return hadith ? { kind: 'hadith', key: `h:${ref.col}:${hadith.n}`, score: 99, hadith } : null;
}

/** Looks up a single record by its key (q:2:255, h:bukhari:6405, d:42:0). */
export async function getByKey(key: string): Promise<Hit | null> {
  const [kind, a, b] = key.split(':');
  if (kind === 'q') return resolveReference({ kind: 'quran', s: +a, a: +b });
  if (kind === 'h') return resolveReference({ kind: 'hadith', col: a, n: b });
  if (kind === 'd') {
    const h = await loadHisn();
    const chapter = h.chapters[+a];
    if (!chapter || chapter.text[+b] == null) return null;
    return { kind: 'hisn', key, score: 99, chapter, index: +b };
  }
  return null;
}

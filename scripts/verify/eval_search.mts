// Measures how often the app's own search and "Verify" logic find the right source, using test questions
// built from INDEPENDENT references (KFGQPC Quran, Sunnah.com hadith, a second copy of Hisn al-Muslim).
//
//   npx tsx --tsconfig scripts/verify/tsconfig.json scripts/verify/eval_search.mts
//
// Needs public/data (npm run data) and scripts/verify/.cache (python3 scripts/verify/verify_data.py).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { retrieve, ruleVerdict } from '../../src/lib/ai';
import { search, type Hit } from '../../src/lib/search';
import { normalize } from '../../src/lib/text';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CACHE = path.join(HERE, '.cache');
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

// The app fetches "/data/<file>"; serve those from public/data.
globalThis.fetch = (async (url: string) => {
  const file = path.join(ROOT, 'public', String(url).replace(/^\/+/, ''));
  const body = readFileSync(file, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) } as Response;
}) as typeof fetch;

// Seeded random numbers, so every run uses the same test questions.
let seed = 20261018;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: T[], n: number) => {
  const copy = [...xs];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
};
const words = (s: string) => normalize(s).trim().split(' ').filter(Boolean);
const fragment = (s: string, n: number, from = 0.5) => {
  const w = words(s);
  if (w.length <= n) return w.join(' ');
  const start = Math.min(w.length - n, Math.floor(w.length * from));
  return w.slice(start, start + n).join(' ');
};

type Case = { query: string; expect: (h: Hit) => boolean };
async function run(name: string, cases: Case[], opts: Parameters<typeof search>[1]) {
  let top1 = 0;
  let top5 = 0;
  let top20 = 0;
  const misses: string[] = [];
  for (const c of cases) {
    const hits = await search(c.query, { ...opts, limit: 20 });
    const rank = hits.findIndex(c.expect);
    if (rank === 0) top1++;
    if (rank >= 0 && rank < 5) top5++;
    if (rank >= 0) top20++;
    else if (misses.length < 5) misses.push(c.query);
  }
  const p = (x: number) => Math.round((1000 * x) / cases.length) / 10;
  const r = { cases: cases.length, top1_pct: p(top1), top5_pct: p(top5), top20_pct: p(top20), example_misses: misses };
  console.error(`${name}: top1 ${r.top1_pct}%  top5 ${r.top5_pct}%  top20 ${r.top20_pct}%`);
  return r;
}

const report: Record<string, unknown> = {};

// ---- Quran: 5 consecutive words of an ayah (KFGQPC simple spelling) -> that ayah
const kfg = read(path.join(CACHE, 'kfgqpc_hafs_v18.json')) as { sora: number; aya_no: number; aya_text_emlaey: string }[];
const quranCases = pick(kfg.filter((a) => words(a.aya_text_emlaey).length >= 7), 300).map((a) => ({
  query: fragment(a.aya_text_emlaey, 5),
  expect: (h: Hit) => h.kind === 'quran' && h.ayah.s === a.sora && h.ayah.a === a.aya_no,
}));
report.quran_arabic_5_words = await run('Quran (Arabic, 5 words)', quranCases, { sources: ['quran'] });

// ---- Hadith: Sunnah.com text -> that hadith (number checked as Sunnah.com cites it)
const COLS: Record<string, string> = { bukhari: 'sahih_bukhari', muslim: 'sahih_muslim', abudawud: 'sunan_abi_dawud', tirmidhi: 'jami_at_tirmidhi', nasai: 'sunan_an_nasai', ibnmajah: 'sunan_ibn_majah' };
type Ref = { col: string; num: string; ar: string; en: string };
const refs: Ref[] = [];
for (const [col, file] of Object.entries(COLS)) {
  const d = read(path.join(CACHE, 'sunnah', `${file}.json`));
  for (const b of d.all_books)
    for (const h of b.hadith_list) {
      const m = String(h.title).match(/\s(\d+)\s*([a-z]{0,2})\b(?:\s*[-,].*)?$/);
      if (!m || /introduction/i.test(h.title) || !h.arabic_text || !h.english_text) continue;
      refs.push({ col, num: m[1] + m[2], ar: h.arabic_text, en: h.english_text });
    }
}
const hadithSample = pick(refs.filter((r) => words(r.ar).length > 40 && words(r.en).length > 25), 300);
const sameHadith = (r: Ref) => (h: Hit) => h.kind === 'hadith' && h.hadith.col === r.col && (h.hadith.n === r.num || h.hadith.n.replace(/[a-z,\-]+$/, '') === r.num.replace(/[a-z]+$/, ''));
// Arabic: 6 words from the last third (the Prophet's words, after the chain of narrators)
report.hadith_arabic_6_words = await run('Hadith (Arabic, 6 words of the matn)', hadithSample.map((r) => ({ query: fragment(r.ar, 6, 0.7), expect: sameHadith(r) })), { sources: ['hadith'] });
// English: 8 words from the middle
report.hadith_english_8_words = await run('Hadith (English, 8 words)', hadithSample.map((r) => ({ query: fragment(r.en, 8, 0.5), expect: sameHadith(r) })), { sources: ['hadith'] });

// ---- Hisn al-Muslim: words of a dua from the second copy -> a dua in the same chapter
const az = read(path.join(CACHE, 'npm', 'azkar', 'azkars.json')) as Record<string, { zekr: string }[]>;
const hisn = read(path.join(ROOT, 'public/data/hisn.json')).chapters as { id: number; ar: string }[];
const chapterOf = new Map(hisn.map((c) => [normalize(c.ar).trim(), c.id]));
const hisnCases: Case[] = [];
for (const [cat, list] of Object.entries(az)) {
  const id = chapterOf.get(normalize(cat).trim());
  if (id == null) continue;
  for (const z of list) if (words(z.zekr).length >= 6) hisnCases.push({ query: fragment(z.zekr, 5, 0.2), expect: (h) => h.kind === 'hisn' && h.chapter.id === id });
}
report.hisn_arabic_5_words = await run('Hisn al-Muslim (Arabic, 5 words)', pick(hisnCases, 150), { sources: ['hisn'] });

// ---- Verify screen without AI (rule-based verdict)
async function verdicts(name: string, claims: string[], good: (v: string) => boolean) {
  const counts: Record<string, number> = {};
  let ok = 0;
  for (const c of claims) {
    const v = ruleVerdict(await retrieve(c));
    counts[v] = (counts[v] ?? 0) + 1;
    if (good(v)) ok++;
  }
  const r = { cases: claims.length, correct_pct: Math.round((1000 * ok) / claims.length) / 10, verdicts: counts };
  console.error(`${name}: ${r.correct_pct}% correct  ${JSON.stringify(counts)}`);
  return r;
}
const authentic = [
  ...pick(kfg.filter((a) => words(a.aya_text_emlaey).length >= 8), 40).map((a) => fragment(a.aya_text_emlaey, 8, 0.2)),
  ...pick(refs.filter((r) => (r.col === 'bukhari' || r.col === 'muslim') && words(r.en).length > 30), 40).map((r) => fragment(r.en, 12, 0.4)),
];
report.verify_real_quotes = await verdicts('Verify: real quotes (should be "found")', authentic, (v) => v === 'found');

const surahs = ['Yasin', 'Al-Mulk', 'Al-Waqiah', 'Al-Kahf', 'Ar-Rahman', 'Al-Ikhlas'];
const rewards = ['will never be poor', 'will be cured of every illness', 'will get a palace in paradise', 'will have all his debts paid', 'will find a spouse within a month'];
const days = ['Tuesday night', 'every Friday after Asr', 'at sunrise', 'forty days in a row'];
const fake = Array.from({ length: 50 }, (_, i) => `Whoever recites Surah ${surahs[i % surahs.length]} ${[7, 11, 41, 70, 313][i % 5]} times ${days[i % days.length]} ${rewards[i % rewards.length]}`);
report.verify_made_up_claims = await verdicts('Verify: made-up claims (must NOT be "found")', fake, (v) => v !== 'found');

const realDuas = Object.values(az).flat().filter((z) => words(z.zekr).length >= 6 && words(z.zekr).length <= 25);
const embellished = pick(realDuas, 40).map((z, i) => `${words(z.zekr).slice(0, 12).join(' ')} ${['مائة مرة', 'سبعين مرة'][i % 2]} ${['ليلة الثلاثاء', 'بعد العصر'][i % 2]} ${['يرزقه الله زوجة صالحة', 'يقضي الله دينه في أسبوع', 'لا يمرض أبدا'][i % 3]}`);
report.verify_real_dua_with_invented_reward = await verdicts('Verify: real dua + invented reward (should be "partial")', embellished, (v) => v === 'partial');

writeFileSync(path.join(HERE, 'search_report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));

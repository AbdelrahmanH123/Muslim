#!/usr/bin/env node
// Downloads the verified source texts and writes compact JSON files to public/data.
// Run with: npm run data
//
// Sources (all free / openly published):
//   Quran Arabic text:                  King Fahd Glorious Quran Printing Complex (KFGQPC) Hafs data,
//                                       github.com/thetruetruth/quran-data-kfgqpc
//   Translation, tafsir, surah names:   github.com/fawazahmed0/quran-api (from Tanzil & QuranEnc)
//   Hadith with gradings:               github.com/fawazahmed0/hadith-api
//   Extra gradings shown on Sunnah.com: github.com/Jammooly1/hadiths-json-files
//   Hisn al-Muslim (Arabic):            github.com/rn0x/hisn_almuslim_json
//
// scripts/verify/verify_data.py checks the result against independent sources.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HISN_EN_TITLES } from './hisn-titles.mjs';

const OUT = path.resolve(process.argv[2] ?? 'public/data');
const QURAN = 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1';
const HADITH = 'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1';
const HISN = 'https://raw.githubusercontent.com/rn0x/hisn_almuslim_json/main/hisn_almuslim.json';
const KFGQPC = 'https://raw.githubusercontent.com/thetruetruth/quran-data-kfgqpc/main/hafs/data/hafsData_v18.json';
const SUNNAH = 'https://raw.githubusercontent.com/Jammooly1/hadiths-json-files/HEAD';
const SUNNAH_FILES = {
  bukhari: 'sahih_bukhari', muslim: 'sahih_muslim', abudawud: 'sunan_abi_dawud',
  tirmidhi: 'jami_at_tirmidhi', nasai: 'sunan_an_nasai', ibnmajah: 'sunan_ibn_majah',
};

// Invisible direction marks that some sources leave inside words.
const clean = (s) => (s ?? '').replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/[ \t]+/g, ' ').trim();

// Arabic letters only, for matching texts between sources.
function arabicWords(s) {
  return (s ?? '')
    .normalize('NFC')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u064A ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}
function sameText(a, b) {
  const A = new Set(arabicWords(a));
  const B = new Set(arabicWords(b));
  if (!A.size || !B.size) return false;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / Math.min(A.size, B.size) >= 0.7;
}

export const COLLECTIONS = [
  { id: 'bukhari', en: 'Sahih al-Bukhari', ar: 'صحيح البخاري', sahih: true },
  { id: 'muslim', en: 'Sahih Muslim', ar: 'صحيح مسلم', sahih: true },
  { id: 'abudawud', en: 'Sunan Abi Dawud', ar: 'سنن أبي داود' },
  { id: 'tirmidhi', en: "Jami' at-Tirmidhi", ar: 'جامع الترمذي' },
  { id: 'nasai', en: "Sunan an-Nasa'i", ar: 'سنن النسائي' },
  { id: 'ibnmajah', en: 'Sunan Ibn Majah', ar: 'سنن ابن ماجه' },
  { id: 'malik', en: "Muwatta Malik", ar: 'موطأ مالك' },
  { id: 'nawawi', en: "An-Nawawi's 40 Hadith", ar: 'الأربعون النووية' },
  { id: 'qudsi', en: '40 Hadith Qudsi', ar: 'الأحاديث القدسية' },
];

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt >= 4) throw new Error(`Failed to download ${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

async function save(name, data) {
  const file = path.join(OUT, name);
  await mkdir(path.dirname(file), { recursive: true });
  const body = JSON.stringify(data);
  await writeFile(file, body);
  console.log(`  ${name}  ${(Buffer.byteLength(body) / 1e6).toFixed(1)} MB`);
}

async function buildQuran() {
  console.log('Quran…');
  const [info, kfgqpc, en, muyassar, jalalayn] = await Promise.all([
    getJson(`${QURAN}/info.json`),
    getJson(KFGQPC),
    getJson(`${QURAN}/editions/eng-rowwadtranslati.min.json`),
    getJson(`${QURAN}/editions/ara-kingfahadquranc.min.json`),
    getJson(`${QURAN}/editions/ara-jalaladdinalmah.min.json`),
  ]);
  const surahs = info.chapters.map((c) => ({
    n: c.chapter,
    ar: c.arabicname,
    tr: c.name,
    en: c.englishname,
    rev: c.revelation,
    count: c.verses.length,
  }));
  // KFGQPC writes the open tanween forms with code points meant for its own font; use the standard
  // Unicode characters instead (a one-to-one mapping: same marks, same positions) so any Arabic font shows them.
  const TANWEEN = { '\u0657': '\u08F0', '\u065E': '\u08F1', '\u0656': '\u08F2' };
  const kfg = [...kfgqpc].sort((a, b) => a.sora - b.sora || a.aya_no - b.aya_no);
  if (kfg.length !== 6236 || kfg.length !== en.quran.length) throw new Error(`Unexpected ayah count: ${kfg.length}`);
  // [surah, ayah, arabic (Uthmani), arabic (simple spelling, for search), english]
  const ayat = kfg.map((v, i) => {
    const t = en.quran[i];
    if (t.chapter !== v.sora || t.verse !== v.aya_no) throw new Error(`Translation out of step at ${v.sora}:${v.aya_no}`);
    const arabic = clean(v.aya_text.replace(/[\u0660-\u0669]+\s*$/, '').replace(/[\u0657\u065E\u0656]/g, (c) => TANWEEN[c]));
    return [v.sora, v.aya_no, arabic, clean(v.aya_text_emlaey), clean(t.text)];
  });
  for (const s of surahs) {
    const n = ayat.filter((a) => a[0] === s.n).length;
    if (n !== s.count) throw new Error(`Surah ${s.n}: ${n} ayat, expected ${s.count}`);
  }
  await save('quran.json', {
    source: {
      arabic: 'King Fahd Glorious Quran Printing Complex — Hafs (Madinah Mushaf) text, qurancomplex.gov.sa',
      english: 'Rowwad Translation Center, quranenc.com',
    },
    surahs,
    ayat,
  });
  await save('tafsir-muyassar.json', {
    name: { en: 'Tafsir al-Muyassar (King Fahd Quran Complex)', ar: 'التفسير الميسر — مجمع الملك فهد' },
    text: muyassar.quran.map((v) => clean(v.text)),
  });
  await save('tafsir-jalalayn.json', {
    name: { en: 'Tafsir al-Jalalayn', ar: 'تفسير الجلالين' },
    text: jalalayn.quran.map((v) => clean(v.text)),
  });
}

function detectNarrator(text) {
  const t = text.trim();
  let m = t.match(/^Narrated ([^:]{2,80}?)\s*:/);
  if (m) return m[1].trim();
  m = t.match(/^It was narrated (?:from|that) ([A-Z][^,:]{2,60}?)(?: that| said|:|,)/);
  if (m && !/^(It|He|She|They)\b/.test(m[1])) return m[1].trim();
  m = t.match(/^([A-Z][A-Za-z'`\-. ]{2,60}?) reported\b/);
  if (m && !/^(It|He|She|They|This|That|A|The)\b|\b(is|was|has|have|been|hadith|narrated|similar|same|with)\b/.test(m[1])) return m[1].trim();
  return '';
}

/** Hadith number as cited on Sunnah.com: 402.2 -> "402b", 3033.02 -> "3033b". */
function citedNumber(num) {
  const [whole, part] = String(num).split('.');
  if (!part) return whole;
  let k = Number(part);
  let letters = '';
  while (k > 0) {
    letters = String.fromCharCode(97 + ((k - 1) % 26)) + letters;
    k = Math.floor((k - 1) / 26);
  }
  return whole + letters;
}

/** Sunnah.com entries keyed by cited number ("391", "125b"), with their book, texts and grading. */
async function sunnahData(id) {
  const file = SUNNAH_FILES[id];
  if (!file) return new Map();
  const data = await getJson(`${SUNNAH}/${file}.json`);
  const out = new Map();
  for (const book of data.all_books)
    for (const h of book.hadith_list) {
      const title = String(h.title).trim();
      const intro = title.match(/introduction\s+(\d+)/i);
      const m = intro ? [null, `i${intro[1]}`, ''] : title.match(/\s(\d+)\s*([a-z]{0,2})\b(?:\s*[-,].*)?$/);
      if (!m) continue;
      const raw = clean(String(h.grade ?? '').replace(/\u00a0/g, ' '));
      const g = raw.match(/^(.+?)\s*\(([^)]+)\)/);
      const key = m[1] + m[2];
      const list = out.get(key) ?? [];
      list.push({
        // e.g. "546b-d" or "928b,927i,929b" when Sunnah.com files one entry under several numbers
        label: title.replace(/^.*?\s(?=\d)/, '').replace(/\s+/g, ''),
        book: Number(book.num) || 0,
        ar: clean(h.arabic_text),
        en: clean(`${h.narrator ?? ''} ${h.english_text ?? ''}`),
        grade: g ? [`${g[2].trim()} (Sunnah.com)`, g[1].trim()] : null,
      });
      out.set(key, list);
    }
  return out;
}

async function buildHadith() {
  for (const c of COLLECTIONS) {
    console.log(`Hadith: ${c.en}…`);
    const [en, ar, extra] = await Promise.all([
      getJson(`${HADITH}/editions/eng-${c.id}.min.json`),
      getJson(`${HADITH}/editions/ara-${c.id}.min.json`),
      sunnahData(c.id),
    ]);
    const arByNum = new Map(ar.hadiths.map((h) => [String(h.hadithnumber), h]));
    // All Sunnah.com entries with their word sets, to recover numbers the main source is missing.
    const sunnahEntries = [...extra.entries()].flatMap(([key, list]) => list.map((x) => ({ key, x, words: new Set(arabicWords(x.ar)) })));
    const findInSunnah = (text) => {
      const A = new Set(arabicWords(text));
      let best = null;
      let bestScore = 0.7;
      for (const e of sunnahEntries) {
        if (!A.size || !e.words.size) continue;
        let both = 0;
        for (const w of A) if (e.words.has(w)) both++;
        const score = both / Math.min(A.size, e.words.size);
        if (score > bestScore) [best, bestScore] = [e, score];
      }
      return best;
    };
    const hadiths = [];
    const seen = new Set();
    let intro = 0;
    let added = 0;
    for (const h of en.hadiths) {
      const a = arByNum.get(String(h.hadithnumber));
      const arText = clean(a?.text);
      if (!h.text?.trim() && !arText) continue;
      let n = citedNumber(h.hadithnumber);
      if (c.id === 'muslim') {
        // The source's own sequence differs from the standard numbering that everyone cites.
        const std = a?.arabicnumber ?? h.arabicnumber;
        if (std != null) n = citedNumber(std);
        else {
          // No standard number in the source: take it from Sunnah.com when the text matches, otherwise it is
          // part of Muslim's introduction (muqaddimah), which has no standard hadith numbers ("i" = introduction).
          // No standard number in the source: take Sunnah.com's number (or multi-number label such as "546b-d")
          // when the text matches; otherwise mark it "u" = no standard number.
          const e = findInSunnah(arText);
          const label = e ? (e.key.startsWith('i') ? e.key : e.x.label) : null;
          n = e && !seen.has(e.key) ? e.key : label && !seen.has(label) ? label : `u${++intro}`;
        }
      }
      if (seen.has(n)) throw new Error(`${c.id}: duplicate hadith number ${n}`);
      seen.add(n);
      const grades = (h.grades ?? []).map((g) => [g.name, g.grade]);
      for (const x of extra.get(n) ?? extra.get(n.replace(/[a-z]+$/, '')) ?? [])
        if (x.grade && sameText(x.ar, arText)) {
          const by = x.grade[0].replace(' (Sunnah.com)', '').toLowerCase();
          const dup = grades.some((g) => g[0].toLowerCase() === by && g[1].toLowerCase() === x.grade[1].toLowerCase());
          if (!dup) {
            grades.push(x.grade);
            added++;
          }
          break;
        }
      hadiths.push([n, h.reference?.book ?? 0, clean(h.text), arText, detectNarrator(h.text ?? ''), grades]);
    }
    // Fill hadith that the main source leaves empty, from Sunnah.com, unless the text is already present.
    const signature = (t) => arabicWords(t).slice(0, 15).join(' ');
    const have = new Set(hadiths.map((h) => signature(h[3])));
    let filled = 0;
    for (const [n, list] of extra) {
      if (seen.has(n) || !list.some((x) => x.ar)) continue;
      if (list.some((x) => have.has(signature(x.ar)))) continue;
      const en = list.map((x) => x.en).join('\n\n');
      hadiths.push([n, list[0].book, en, list.map((x) => x.ar).join('\n\n'), detectNarrator(en), list.flatMap((x) => (x.grade ? [x.grade] : []))]);
      seen.add(n);
      filled++;
    }
    const order = (n) => (n.startsWith('i') ? -1e9 + Number(n.slice(1)) : parseInt(n, 10) + (n.match(/[a-z]+$/)?.[0].length ?? 0) * 0.001);
    hadiths.sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]));
    if (extra.size) console.log(`    + ${added} gradings and ${filled} missing hadith from Sunnah.com`);
    await save(`hadith/${c.id}.json`, {
      id: c.id,
      name: { en: c.en, ar: c.ar },
      sahih: !!c.sahih,
      sections: en.metadata.sections,
      hadiths,
    });
  }
}

// Corrections to the Hisn al-Muslim source text. Each one was found by scripts/verify and is backed by
// a second copy of the book AND the original hadith or Arabic grammar; see docs/VERIFICATION.md.
const HISN_PATCHES = [
  {
    chapter: 17, item: 1,
    from: 'سبحانك اللهم وبحمد ك وتبارك اسمك وتعالى جدك، ولا أ له غيرك',
    to: 'سبحانك اللهم وبحمدك، وتبارك اسمك، وتعالى جدك، ولا إله غيرك',
    why: 'Broken words ("وبحمد ك", "أ له"). Matches the azkar copy of the book and Jami at-Tirmidhi 242 word for word.',
  },
  {
    chapter: 13, item: 3,
    from: 'وهب لي نوراً على نوراً',
    to: 'وهب لي نوراً على نورٍ',
    why: 'Case ending after "على" must be genitive; the azkar copy of the book has "عَلَى نُورٍ".',
  },
];

async function buildHisn() {
  console.log('Hisn al-Muslim…');
  const data = await getJson(HISN);
  const chapters = Object.entries(data).map(([title, body], i) => ({
    id: i,
    ar: clean(title),
    en: HISN_EN_TITLES[i] ?? '',
    text: (body.text ?? []).map(clean),
    notes: (body.footnote ?? []).map(clean),
  }));
  for (const p of HISN_PATCHES) {
    const c = chapters[p.chapter];
    if (clean(c?.text[p.item] ?? '') !== p.from) throw new Error(`Hisn patch ${p.chapter}:${p.item} no longer matches the source`);
    c.text[p.item] = p.to;
  }
  await save('hisn.json', {
    name: { en: 'Hisn al-Muslim (Fortress of the Muslim) — Sa‘id ibn ‘Ali ibn Wahf al-Qahtani', ar: 'حصن المسلم — سعيد بن علي بن وهف القحطاني' },
    chapters,
  });
}

console.log(`Writing data to ${OUT}`);
await buildQuran();
await buildHisn();
await buildHadith();
await save('manifest.json', {
  built: new Date().toISOString(),
  collections: COLLECTIONS.map(({ id, en, ar, sahih }) => ({ id, name: { en, ar }, sahih: !!sahih })),
});
console.log('Done.');

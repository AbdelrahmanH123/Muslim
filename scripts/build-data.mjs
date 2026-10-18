#!/usr/bin/env node
// Downloads the verified source texts and writes compact JSON files to public/data.
// Run with: npm run data
//
// Sources (all free / openly published):
//   Quran text, translation and tafsir: github.com/fawazahmed0/quran-api (from Tanzil & QuranEnc)
//   Hadith with gradings:               github.com/fawazahmed0/hadith-api
//   Hisn al-Muslim (Arabic):            github.com/rn0x/hisn_almuslim_json
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HISN_EN_TITLES } from './hisn-titles.mjs';

const OUT = path.resolve(process.argv[2] ?? 'public/data');
const QURAN = 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1';
const HADITH = 'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1';
const HISN = 'https://raw.githubusercontent.com/rn0x/hisn_almuslim_json/main/hisn_almuslim.json';

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
  const [info, uthmani, simple, en, muyassar, jalalayn] = await Promise.all([
    getJson(`${QURAN}/info.json`),
    getJson(`${QURAN}/editions/ara-quranuthmanihaf.min.json`),
    getJson(`${QURAN}/editions/ara-quransimple.min.json`),
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
  // [surah, ayah, arabic (Uthmani), arabic (simple, for search), english]
  const ayat = uthmani.quran.map((v, i) => [v.chapter, v.verse, v.text, simple.quran[i].text, en.quran[i].text]);
  await save('quran.json', {
    source: {
      arabic: 'Tanzil Project — Uthmani (Hafs) text, tanzil.net',
      english: 'Rowwad Translation Center, quranenc.com',
    },
    surahs,
    ayat,
  });
  await save('tafsir-muyassar.json', {
    name: { en: 'Tafsir al-Muyassar (King Fahd Quran Complex)', ar: 'التفسير الميسر — مجمع الملك فهد' },
    text: muyassar.quran.map((v) => v.text),
  });
  await save('tafsir-jalalayn.json', {
    name: { en: 'Tafsir al-Jalalayn', ar: 'تفسير الجلالين' },
    text: jalalayn.quran.map((v) => v.text),
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

async function buildHadith() {
  for (const c of COLLECTIONS) {
    console.log(`Hadith: ${c.en}…`);
    const [en, ar] = await Promise.all([
      getJson(`${HADITH}/editions/eng-${c.id}.min.json`),
      getJson(`${HADITH}/editions/ara-${c.id}.min.json`),
    ]);
    const arByNum = new Map(ar.hadiths.map((h) => [String(h.hadithnumber), h.text]));
    const hadiths = [];
    for (const h of en.hadiths) {
      const arText = arByNum.get(String(h.hadithnumber)) ?? '';
      if (!h.text?.trim() && !arText.trim()) continue;
      hadiths.push([
        h.hadithnumber,
        h.reference?.book ?? 0,
        h.text ?? '',
        arText,
        detectNarrator(h.text ?? ''),
        (h.grades ?? []).map((g) => [g.name, g.grade]),
      ]);
    }
    await save(`hadith/${c.id}.json`, {
      id: c.id,
      name: { en: c.en, ar: c.ar },
      sahih: !!c.sahih,
      sections: en.metadata.sections,
      hadiths,
    });
  }
}

async function buildHisn() {
  console.log('Hisn al-Muslim…');
  const data = await getJson(HISN);
  const chapters = Object.entries(data).map(([title, body], i) => ({
    id: i,
    ar: title,
    en: HISN_EN_TITLES[i] ?? '',
    text: body.text ?? [],
    notes: body.footnote ?? [],
  }));
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

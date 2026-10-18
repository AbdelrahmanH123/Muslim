// Loads the library files produced by scripts/build-data.mjs.
// Web: served from the site's own /data folder. Android: downloaded from the website (see app.json "extra.dataUrl").
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { normalize } from './text';

export type Lang = 'en' | 'ar';
export type Bilingual = { en: string; ar: string };

export type Surah = { n: number; ar: string; tr: string; en: string; rev: string; count: number };
export type Ayah = { s: number; a: number; ar: string; en: string; norm: string };
export type Quran = { surahs: Surah[]; ayat: Ayah[]; source: { arabic: string; english: string } };

export type Grade = [by: string, grade: string];
export type Hadith = {
  col: string;
  n: number;
  book: number;
  en: string;
  ar: string;
  narrator: string;
  grades: Grade[];
  norm: string;
};
export type Collection = {
  id: string;
  name: Bilingual;
  sahih: boolean;
  sections: Record<string, string>;
  hadiths: Hadith[];
  byNumber: Map<string, Hadith>;
};
export type CollectionInfo = { id: string; name: Bilingual; sahih: boolean };

export type HisnChapter = { id: number; ar: string; en: string; text: string[]; notes: string[]; norm: string[] };
export type Hisn = { name: Bilingual; chapters: HisnChapter[] };
export type Tafsir = { name: Bilingual; text: string[] };

export const TAFSIRS = [
  { id: 'muyassar', name: { en: 'Tafsir al-Muyassar', ar: 'التفسير الميسر' } },
  { id: 'jalalayn', name: { en: 'Tafsir al-Jalalayn', ar: 'تفسير الجلالين' } },
] as const;

// Kept in sync with COLLECTIONS in scripts/build-data.mjs.
export const COLLECTIONS: CollectionInfo[] = [
  { id: 'bukhari', name: { en: 'Sahih al-Bukhari', ar: 'صحيح البخاري' }, sahih: true },
  { id: 'muslim', name: { en: 'Sahih Muslim', ar: 'صحيح مسلم' }, sahih: true },
  { id: 'abudawud', name: { en: 'Sunan Abi Dawud', ar: 'سنن أبي داود' }, sahih: false },
  { id: 'tirmidhi', name: { en: "Jami' at-Tirmidhi", ar: 'جامع الترمذي' }, sahih: false },
  { id: 'nasai', name: { en: "Sunan an-Nasa'i", ar: 'سنن النسائي' }, sahih: false },
  { id: 'ibnmajah', name: { en: 'Sunan Ibn Majah', ar: 'سنن ابن ماجه' }, sahih: false },
  { id: 'malik', name: { en: 'Muwatta Malik', ar: 'موطأ مالك' }, sahih: false },
  { id: 'nawawi', name: { en: "An-Nawawi's 40 Hadith", ar: 'الأربعون النووية' }, sahih: false },
  { id: 'qudsi', name: { en: '40 Hadith Qudsi', ar: 'الأحاديث القدسية' }, sahih: false },
];
export const collectionInfo = (id: string) => COLLECTIONS.find((c) => c.id === id);

function dataBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as { dataUrl?: string };
  if (Platform.OS === 'web') {
    const base = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '';
    return `${base.replace(/\/$/, '')}/data`;
  }
  return extra.dataUrl ?? 'https://abdelrahmanh123.github.io/Muslim/data';
}

async function fetchJson<T>(file: string): Promise<T> {
  const url = `${dataBaseUrl()}/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) {
    const p = load();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key) as Promise<T>;
}

export function loadQuran(): Promise<Quran> {
  return once('quran', async () => {
    const raw = await fetchJson<{
      surahs: Surah[];
      ayat: [number, number, string, string, string][];
      source: Quran['source'];
    }>('quran.json');
    const ayat = raw.ayat.map(([s, a, ar, simple, en]) => ({ s, a, ar, en, norm: normalize(simple + ' ' + en) }));
    return { surahs: raw.surahs, ayat, source: raw.source };
  });
}

/** Index of an ayah in Quran.ayat. */
export function ayahIndex(q: Quran, s: number, a: number): number {
  let i = 0;
  for (let k = 0; k < s - 1; k++) i += q.surahs[k].count;
  return i + a - 1;
}

export function loadTafsir(id: string): Promise<Tafsir> {
  return once(`tafsir-${id}`, () => fetchJson<Tafsir>(`tafsir-${id}.json`));
}

export function loadHisn(): Promise<Hisn> {
  return once('hisn', async () => {
    const raw = await fetchJson<{ name: Bilingual; chapters: Omit<HisnChapter, 'norm'>[] }>('hisn.json');
    return {
      name: raw.name,
      chapters: raw.chapters.map((c) => ({ ...c, norm: c.text.map((t) => normalize(t + ' ' + c.ar + ' ' + c.en)) })),
    };
  });
}

export function loadCollection(id: string): Promise<Collection> {
  return once(`hadith-${id}`, async () => {
    const raw = await fetchJson<{
      id: string;
      name: Bilingual;
      sahih: boolean;
      sections: Record<string, string>;
      hadiths: [number, number, string, string, string, Grade[]][];
    }>(`hadith/${id}.json`);
    const hadiths = raw.hadiths.map(([n, book, en, ar, narrator, grades]) => ({
      col: id,
      n,
      book,
      en,
      ar,
      narrator,
      grades,
      norm: normalize(en + ' ' + ar),
    }));
    return { ...raw, hadiths, byNumber: new Map(hadiths.map((h) => [String(h.n), h])) };
  });
}

export function isLoaded(key: string) {
  return cache.has(key);
}

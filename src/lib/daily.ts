// Verse and hadith of the day: the same for everyone on a given date, rotating through curated, authentic pools.
import { loadCollection } from './data';
import { getByKey, type Hit } from './search';
import { TOPICS } from './topics';

function dayNumber(d = new Date()) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2020, 0, 1)) / 86_400_000);
}

// Ayat chosen for the topic pages (each checked against the Quran text).
const AYAT = [...new Set(TOPICS.flatMap((t) => t.ayat.map(([s, a]) => `q:${s}:${a}`)))];

export async function ayahOfTheDay(): Promise<Hit | null> {
  return getByKey(AYAT[dayNumber() % AYAT.length]);
}

/** From An-Nawawi's 40 Hadith and the 40 Hadith Qudsi, alternating day by day. */
export async function hadithOfTheDay(): Promise<Hit | null> {
  const n = dayNumber();
  const col = await loadCollection(n % 2 ? 'qudsi' : 'nawawi');
  const usable = col.hadiths.filter((h) => h.en.trim() && h.ar.trim());
  const hadith = usable[Math.floor(n / 2) % usable.length];
  return hadith ? { kind: 'hadith', key: `h:${col.id}:${hadith.n}`, score: 1, hadith } : null;
}

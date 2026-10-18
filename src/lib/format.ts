import { collectionInfo, type Lang } from './data';
import { hadithGrade, type GradeLevel } from './grades';
import type { Hit } from './search';

/** Human readable reference, e.g. "Quran 2:255 (Al-Baqarah)" or "Sahih al-Bukhari 6405". */
export function hitTitle(hit: Hit, lang: Lang): string {
  if (hit.kind === 'quran') {
    const name = lang === 'ar' ? hit.surahName.ar : hit.surahName.tr;
    return lang === 'ar'
      ? `${name} — آية ${hit.ayah.a} (${hit.ayah.s}:${hit.ayah.a})`
      : `Quran ${hit.ayah.s}:${hit.ayah.a} — ${name}`;
  }
  if (hit.kind === 'hisn') {
    const name = lang === 'ar' ? hit.chapter.ar : hit.chapter.en || hit.chapter.ar;
    return lang === 'ar' ? `حصن المسلم — ${name}` : `Hisn al-Muslim — ${name}`;
  }
  const col = collectionInfo(hit.hadith.col);
  return `${col ? col.name[lang] : hit.hadith.col} ${hit.hadith.n}`;
}

export function hitArabic(hit: Hit): string {
  if (hit.kind === 'quran') return hit.ayah.ar;
  if (hit.kind === 'hisn') return hit.chapter.text[hit.index];
  return hit.hadith.ar;
}

export function hitEnglish(hit: Hit): string {
  if (hit.kind === 'quran') return hit.ayah.en;
  if (hit.kind === 'hisn') return '';
  return hit.hadith.en;
}

export function hitGrade(hit: Hit): GradeLevel | null {
  return hit.kind === 'hadith' ? hadithGrade(hit.hadith) : null;
}

/** Route for a hit's detail page. */
export function hitHref(hit: Hit): string {
  if (hit.kind === 'quran') return `/quran/${hit.ayah.s}?ayah=${hit.ayah.a}`;
  if (hit.kind === 'hisn') return `/hisn/${hit.chapter.id}?item=${hit.index}`;
  return `/hadith/${hit.hadith.col}/${hit.hadith.n}`;
}

export function keyHref(key: string): string {
  const [k, a, b] = key.split(':');
  if (k === 'q') return `/quran/${a}?ayah=${b}`;
  if (k === 'd') return `/hisn/${a}?item=${b}`;
  return `/hadith/${a}/${b}`;
}

/** Plain-text block used when giving a source to the AI model. */
export function hitForPrompt(hit: Hit, n: number): string {
  const lines = [`[${n}] ${hitTitle(hit, 'en')}`];
  const ar = hitArabic(hit);
  const en = hitEnglish(hit);
  if (ar) lines.push(`Arabic: ${clip(ar, 700)}`);
  if (en) lines.push(`English: ${clip(en, 700)}`);
  if (hit.kind === 'hadith') {
    const g = hitGrade(hit);
    lines.push(`Grading: ${g}${hit.hadith.grades.length ? ' (' + hit.hadith.grades.map((x) => `${x[0]}: ${x[1]}`).join('; ') + ')' : ''}`);
  }
  if (hit.kind === 'hisn' && hit.chapter.notes.length) lines.push(`Reference: ${clip(hit.chapter.notes.join(' | '), 300)}`);
  return lines.join('\n');
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);

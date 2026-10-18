import { collectionInfo, type Lang } from './data';
import { hadithGrade, type GradeLevel } from './grades';
import type { Hit } from './search';

/** "Sahih Muslim 3033b"; "i8" = Introduction 8 (Sunnah.com numbering); "u3" = entry without a standard number. */
export function hadithRef(col: string, n: string, lang: Lang): string {
  const name = collectionInfo(col)?.name[lang] ?? col;
  if (n.startsWith('i')) return lang === 'ar' ? `${name}، المقدمة ${n.slice(1)}` : `${name}, Introduction ${n.slice(1)}`;
  if (n.startsWith('u')) return lang === 'ar' ? `${name} (بدون رقم معتمد)` : `${name} (no standard number)`;
  return `${name} ${n.replace(/,/g, ', ')}`;
}

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
  return hadithRef(hit.hadith.col, hit.hadith.n, lang);
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

/** Text for copying/sharing: the words, then exactly where they come from (and the grading for hadith). */
export function citationText(hit: Hit, lang: Lang): string {
  const parts = [hitArabic(hit), hitEnglish(hit)].filter(Boolean);
  let source = hitTitle(hit, lang);
  if (hit.kind === 'hadith') {
    const g = hit.hadith.grades.map(([by, grade]) => `${grade} (${by})`).join('; ');
    if (hit.hadith.narrator) source += ` — ${lang === 'ar' ? 'الراوي' : 'Narrated by'} ${hit.hadith.narrator}`;
    if (g) source += `\n${lang === 'ar' ? 'الحكم' : 'Grading'}: ${g}`;
  }
  if (hit.kind === 'hisn' && hit.chapter.notes.length) source += `\n${hit.chapter.notes.join(' | ')}`;
  return `${parts.join('\n\n')}\n\n— ${source}`;
}

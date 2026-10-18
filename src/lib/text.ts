// Text normalisation used for searching Arabic and English.

const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Normalises Arabic and/or Latin text into a lowercase, mark-free, space separated string. */
export function normalize(s: string): string {
  const out = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(ARABIC_MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/[’'`‘ʿʾ]/g, '')
    .replace(/[^a-z0-9\u0621-\u064A\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ' ' + out + ' ';
}

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

const STOP = new Set(
  (
    'a an the and or of to in on for is are was were be been with that this those these it its at by from as ' +
    'what which who whom how when where why do does did i me my we our you your he him his she her they them their ' +
    'can could should would will shall may might there any some about into than then so if not no yes please tell ' +
    'say said says dua duaa hadith ayah ayat verse verses quran islam islamic muslim allah prophet ' +
    'في من على الى إلى عن ما ماذا هل كيف متى اين أين لماذا هو هي هم انا أنا انت أنت نحن ان أن او أو ثم قد لا لم لن ' +
    'هذا هذه ذلك تلك التي الذي الذين مع كل بعض عند اي أي يا و دعاء حديث ايه آية سوره سورة قال'
  )
    .split(/\s+/)
    .map((w) => normalize(w).trim()),
);

/** Splits a query into normalised search terms, dropping very common words. */
export function terms(query: string, keepStopwords = false): string[] {
  const words = normalize(query).trim().split(' ').filter((w) => w.length >= 2);
  const kept = keepStopwords ? words : words.filter((w) => !STOP.has(w));
  return [...new Set(kept.length ? kept : words)];
}

export function snippet(text: string, query: string, len = 220): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= len) return clean;
  const lower = clean.toLowerCase();
  const first = terms(query)
    .map((t) => lower.indexOf(t))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];
  const start = first == null ? 0 : Math.max(0, first - 60);
  return (start > 0 ? '…' : '') + clean.slice(start, start + len) + '…';
}

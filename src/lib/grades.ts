import type { Hadith } from './data';
import { collectionInfo } from './data';

export type GradeLevel = 'sahih' | 'hasan' | 'daif' | 'mawdu' | 'mixed' | 'unknown';

function levelOf(grade: string): GradeLevel {
  const g = grade.toLowerCase();
  if (/mawdu|fabricat|maudu|batil|munkar/.test(g)) return 'mawdu';
  if (/da.?if|weak|daeef|shadh/.test(g)) return 'daif';
  if (/hasan/.test(g) && !/sahih/.test(g)) return 'hasan';
  if (/sahih|authentic|agreed/.test(g)) return 'sahih';
  if (/hasan/.test(g)) return 'hasan';
  return 'unknown';
}

/** Summarises a hadith's grading. Bukhari and Muslim are graded authentic as whole collections. */
export function hadithGrade(h: Hadith): GradeLevel {
  if (collectionInfo(h.col)?.sahih) return 'sahih';
  const levels = [...new Set(h.grades.map((g) => levelOf(g[1])).filter((l) => l !== 'unknown'))];
  if (levels.length === 0) return 'unknown';
  if (levels.length === 1) return levels[0];
  const weak = levels.some((l) => l === 'daif' || l === 'mawdu');
  const strong = levels.some((l) => l === 'sahih' || l === 'hasan');
  if (weak && strong) return 'mixed';
  if (levels.includes('mawdu')) return 'mawdu';
  if (levels.includes('daif')) return 'daif';
  return levels.includes('hasan') ? 'hasan' : 'sahih';
}

export const isAcceptable = (l: GradeLevel) => l === 'sahih' || l === 'hasan';

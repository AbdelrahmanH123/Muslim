// Prayer times and Qibla direction, calculated on the device (no internet needed) with the adhan library.
import { CalculationMethod, Coordinates, Madhab, PrayerTimes, Qibla } from 'adhan';

export const METHODS = {
  MuslimWorldLeague: 'Muslim World League',
  UmmAlQura: 'Umm al-Qura (Makkah)',
  Egyptian: 'Egyptian General Authority',
  Karachi: 'University of Islamic Sciences, Karachi',
  NorthAmerica: 'ISNA (North America)',
  Dubai: 'Dubai',
  Kuwait: 'Kuwait',
  Qatar: 'Qatar',
  Turkey: 'Diyanet (Turkey)',
  Singapore: 'Singapore',
  MoonsightingCommittee: 'Moonsighting Committee',
} as const;
export type MethodId = keyof typeof METHODS;

export type PrayerSettings = {
  method: MethodId;
  hanafiAsr: boolean;
  lat: number | null;
  lng: number | null;
};
export const DEFAULT_PRAYER: PrayerSettings = { method: 'MuslimWorldLeague', hanafiAsr: false, lat: null, lng: null };

export const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerName = (typeof PRAYERS)[number];

export function prayerTimes(s: PrayerSettings, date = new Date()) {
  if (s.lat == null || s.lng == null) return null;
  const params = CalculationMethod[s.method]();
  params.madhab = s.hanafiAsr ? Madhab.Hanafi : Madhab.Shafi;
  const pt = new PrayerTimes(new Coordinates(s.lat, s.lng), date, params);
  const times = Object.fromEntries(PRAYERS.map((p) => [p, pt[p]])) as Record<PrayerName, Date>;
  let next = pt.nextPrayer() as PrayerName | 'none';
  let nextTime = next === 'none' ? null : times[next];
  if (next === 'none') {
    // After Isha: the next prayer is tomorrow's Fajr.
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    next = 'fajr';
    nextTime = new PrayerTimes(new Coordinates(s.lat, s.lng), tomorrow, params).fajr;
  }
  return { times, next, nextTime: nextTime as Date };
}

/** Direction of the Kaaba in degrees clockwise from true north. */
export function qibla(lat: number, lng: number): number {
  return Qibla(new Coordinates(lat, lng));
}

export const formatTime = (d: Date, lang: 'en' | 'ar' = 'en') =>
  d.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : [], { hour: '2-digit', minute: '2-digit' });

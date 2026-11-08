// Dates are plain 'YYYY-MM-DD' strings, like Postgres `date` and Kotlin LocalDate.
export type IsoDate = string;

/** Today's calendar date in `timeZone` (default: the device's). */
export function todayIn(timeZone?: string, now = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const toUtcMs = (d: IsoDate) => Date.parse(`${d}T00:00:00Z`);

export const addDays = (d: IsoDate, days: number): IsoDate =>
  new Date(toUtcMs(d) + days * 86_400_000).toISOString().slice(0, 10);

export const daysBetween = (from: IsoDate, to: IsoDate) => Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);

/** Short date in the user's language: 07/11 (vi) or 11/07 (en), with the year only when it differs. */
export function formatDate(d: IsoDate, lang: 'vi' | 'en', today: IsoDate): string {
  const sameYear = d.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
    day: 'numeric', month: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC',
  }).format(new Date(toUtcMs(d)));
}

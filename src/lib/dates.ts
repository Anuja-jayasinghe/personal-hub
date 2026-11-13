/**
 * Calendar-date helpers. Everything works on plain "YYYY-MM-DD" strings (a day, not a moment in
 * time), so there is no time-zone or daylight-saving drift when comparing due dates.
 * Pure functions: no clock, no config, no database — easy to test.
 */

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Milliseconds at UTC midnight for a "YYYY-MM-DD" string; throws if it is not a real date. */
function utcMidnight(ymd: string): number {
  const m = YMD_RE.exec(ymd);
  if (!m) throw new Error(`Invalid date "${ymd}": expected YYYY-MM-DD`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  // Date.UTC rolls 2026-02-31 over to March; reject anything that did not round-trip.
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`Invalid date "${ymd}": no such calendar day`);
  }
  return ms;
}

/** Whole days from `from` to `to` (positive when `to` is later), e.g. daysBetween("2026-11-13", "2026-11-20") === 7. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY);
}

/** The calendar day `days` after `ymd` (negative for before). */
export function addDays(ymd: string, days: number): string {
  return new Date(utcMidnight(ymd) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The calendar day it currently is in `timeZone` (e.g. "Asia/Colombo") at the instant `now`. */
export function todayIn(timeZone: string, now: Date): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

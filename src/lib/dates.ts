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

/** True when `ymd` is a real calendar day written as "YYYY-MM-DD" (rejects "2026-02-31"). */
export function isValidDate(ymd: string): boolean {
  try {
    utcMidnight(ymd);
    return true;
  } catch {
    return false;
  }
}

/** Whole days from `from` to `to` (positive when `to` is later), e.g. daysBetween("2026-11-13", "2026-11-20") === 7. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY);
}

/** The calendar day `days` after `ymd` (negative for before). */
export function addDays(ymd: string, days: number): string {
  return new Date(utcMidnight(ymd) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A calendar day as day and short month, e.g. dayMonth("2026-12-23") === "23 Dec" (for short messages). */
export function dayMonth(ymd: string): string {
  const d = new Date(utcMidnight(ymd));
  return `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}`;
}

/** The calendar day it currently is in `timeZone` (e.g. "Asia/Colombo") at the instant `now`. */
export function todayIn(timeZone: string, now: Date): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The hour of day (0 to 23) it currently is in `timeZone` at the instant `now`. */
export function hourIn(timeZone: string, now: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now));
}

/** The calendar year of an instant in `timeZone` (e.g. a completion time as the owner would date it). */
export function yearOfInstant(instant: Date, timeZone: string): number {
  return Number(todayIn(timeZone, instant).slice(0, 4));
}

/** "YYYY-MM" of a "YYYY-MM-DD". */
export const monthOf = (ymd: string): string => ymd.slice(0, 7);

/** The month `n` months after `month` ("YYYY-MM"), negative for before, as "YYYY-MM". */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}


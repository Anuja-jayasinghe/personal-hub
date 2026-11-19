import { appConfig } from "@/config/app.config";
import { todayIn } from "@/lib/dates";

const { code, locale, fractionDigits } = appConfig.currency;

const moneyFormatter = new Intl.NumberFormat(locale, {
  style: "currency",
  currency: code,
  minimumFractionDigits: fractionDigits,
  maximumFractionDigits: fractionDigits,
});

/** Formats an amount in the app currency (DECISIONS C21), e.g. "LKR 1,250.00". */
export function formatMoney(amount: number): string {
  return moneyFormatter.format(amount);
}

const dateFormatter = new Intl.DateTimeFormat(locale, {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: appConfig.timeZone,
});

/** Formats a date in the app locale and time zone, e.g. "13 Nov 2026". */
export function formatDate(date: Date | string | number): string {
  return dateFormatter.format(new Date(date));
}

/** Human-readable file size, e.g. "2.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Today's date as "YYYY-MM-DD" in the app time zone (DECISIONS C25). Reads the clock, so only
 * call it from request-time code (after `await connection()`), never while pre-rendering.
 */
export function todayInAppTz(): string {
  return todayIn(appConfig.timeZone, new Date());
}

/** The hour it is now (0 to 23) in the app time zone, for the greeting on Home. Request time only. */
export function hourInAppTz(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: appConfig.timeZone }).format(new Date()));
}

const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" });

/** Formats a "YYYY-MM" month, e.g. "Oct 2026" (the full year, so it is never read as a day). */
export function formatMonth(month: string): string {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
}

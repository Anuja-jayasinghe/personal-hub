import { appConfig } from "@/config/app.config";

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

/**
 * Exact decimal helpers. Money and meter readings are stored as decimal strings with two
 * decimals ("12500.50"); sums are done in whole hundredths so there is no floating-point error.
 * Pure.
 */

/** "12500.50" -> 1250050 (whole hundredths: cents of a rupee, or hundredths of a kWh). */
export function toCents(amount: string): number {
  const [whole, fraction = ""] = amount.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** 1250050 -> "12500.50". Negative numbers keep their sign. */
export function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

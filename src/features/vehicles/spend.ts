import { yearOfInstant } from "@/lib/dates";
import { toCents } from "./service-logic";

/**
 * What a vehicle cost in a calendar year: service costs (by service date) plus the actual cost of
 * fixes completed that year (by completion time, in the app time zone). Whole cents, so sums are
 * exact. Pure.
 */
export function yearSpend(input: {
  services: readonly { serviceDate: string; cost: string | null }[];
  fixes: readonly { completedAt: Date | null; actualCost: string | null }[];
  year: number;
  timeZone: string;
}): { servicesCents: number; fixesCents: number; totalCents: number } {
  let servicesCents = 0;
  for (const s of input.services) {
    if (s.cost !== null && Number(s.serviceDate.slice(0, 4)) === input.year) servicesCents += toCents(s.cost);
  }
  let fixesCents = 0;
  for (const f of input.fixes) {
    if (f.actualCost !== null && f.completedAt !== null && yearOfInstant(f.completedAt, input.timeZone) === input.year) {
      fixesCents += toCents(f.actualCost);
    }
  }
  return { servicesCents, fixesCents, totalCents: servicesCents + fixesCents };
}

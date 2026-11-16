import type { ElectricityBill, ElectricityReading } from "@/db/schema";
import { toCents } from "@/lib/decimal";
import { billStatus } from "./bill-logic";
import { readingRows } from "./overview";
import { latestBill, sinceLastBill } from "./since-bill";
import { toReading } from "./usage";

/** Everything the Electricity page shows about one meter, worked out from its rows. Pure. */
export function describeMeter(input: { bills: readonly ElectricityBill[]; readings: readonly ElectricityReading[]; today: string; cycleDays: number }) {
  const marks = input.bills.map((b) => ({
    billDate: b.billDate,
    readingDate: b.readingDate,
    currentReading: toCents(b.currentReading),
    createdAt: b.createdAt,
    row: b,
  }));
  const readings = input.readings.map(toReading);
  const last = latestBill(marks)?.row;
  const usage = sinceLastBill(marks, readings, input.cycleDays);
  const lastStatus = last ? billStatus(last, input.today) : null;
  const rows = readingRows(readings);
  // Newest reading first; the "latest reading" is only worth a mention if it is newer than the last bill's.
  const latest = rows[0] && (!last || rows[0].date > last.readingDate) ? rows[0] : undefined;
  const billsNewestFirst = [...input.bills].sort(
    (a, b) => b.readingDate.localeCompare(a.readingDate) || b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return { last, lastStatus, usage, latest, readingRows: rows, bills: billsNewestFirst };
}

export type MeterData = ReturnType<typeof describeMeter>;

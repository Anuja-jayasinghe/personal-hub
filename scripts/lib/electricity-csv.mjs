// What `pnpm export:electricity` writes (issue #18, DECISIONS C55). Pure: rows in, CSV text out.
// Dates are plain "YYYY-MM-DD", readings and units are kWh, amounts are in the app currency.
import { toCsv } from "./csv.mjs";

const yesNo = (v) => (v ? "yes" : "no");

const meterColumns = [
  { header: "meter", get: (r) => r.name, text: true },
  { header: "account_number", get: (r) => r.account_number, text: true },
  { header: "archived", get: (r) => yesNo(r.archived_at) },
  { header: "notes", get: (r) => r.notes, text: true },
];

const readingColumns = [
  { header: "meter", get: (r) => r.meter_name, text: true },
  { header: "reading_date", get: (r) => r.reading_date },
  { header: "reading_kwh", get: (r) => r.value },
  { header: "meter_replaced", get: (r) => yesNo(r.replaced_final_value !== null) },
  { header: "old_meter_final_kwh", get: (r) => r.replaced_final_value },
  { header: "source", get: (r) => r.source },
  { header: "note", get: (r) => r.note, text: true },
];

const billColumns = [
  { header: "meter", get: (r) => r.meter_name, text: true },
  { header: "bill_date", get: (r) => r.bill_date },
  { header: "reading_date", get: (r) => r.reading_date },
  { header: "previous_reading_kwh", get: (r) => r.previous_reading },
  { header: "current_reading_kwh", get: (r) => r.current_reading },
  { header: "units_kwh", get: (r) => r.units },
  { header: "amount", get: (r) => r.amount },
  { header: "due_date", get: (r) => r.due_date },
  { header: "paid_date", get: (r) => r.paid_date },
  { header: "notes", get: (r) => r.notes, text: true },
];

/** The three files, newest first for readings and bills (like the app), meters by name. */
export function buildElectricityCsv({ meters, readings, bills }) {
  return {
    "meters.csv": toCsv(meterColumns, meters),
    "readings.csv": toCsv(readingColumns, readings),
    "bills.csv": toCsv(billColumns, bills),
  };
}

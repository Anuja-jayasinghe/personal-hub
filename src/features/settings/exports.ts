import "server-only";
import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { billItems, billPayments, electricityBills, electricityMeters, electricityReadings, vehicleRenewals, vehicleServices, vehicles } from "@/db/schema";
import { toCsv } from "./csv";

/**
 * The spreadsheet downloads on Settings › Data and backup (S.7, C113): one CSV per kind of record,
 * archived ones included, read at the moment you click. Files and photos are not in them; for
 * everything with the files, the full backup (`pnpm backup`) is still the way.
 */
export const EXPORTS = {
  "electricity-readings": {
    label: "Electricity readings",
    group: "Electricity",
    async build() {
      const rows = await db
        .select({
          meter: electricityMeters.name,
          account: electricityMeters.accountNumber,
          date: electricityReadings.readingDate,
          value: electricityReadings.value,
          replacedFinal: electricityReadings.replacedFinalValue,
          source: electricityReadings.source,
          note: electricityReadings.note,
        })
        .from(electricityReadings)
        .innerJoin(electricityMeters, eq(electricityMeters.id, electricityReadings.meterId))
        .orderBy(asc(electricityMeters.name), asc(electricityReadings.readingDate));
      return toCsv(
        ["meter", "account", "date", "reading_kwh", "old_meter_final_kwh", "source", "note"],
        rows.map((r) => [r.meter, r.account, r.date, r.value, r.replacedFinal, r.source, r.note]),
      );
    },
  },
  "electricity-bills": {
    label: "Electricity bills",
    group: "Electricity",
    async build() {
      const rows = await db
        .select({ meter: electricityMeters.name, account: electricityMeters.accountNumber, b: electricityBills })
        .from(electricityBills)
        .innerJoin(electricityMeters, eq(electricityMeters.id, electricityBills.meterId))
        .orderBy(asc(electricityMeters.name), asc(electricityBills.billDate));
      return toCsv(
        ["meter", "account", "bill_date", "reading_date", "previous_kwh", "current_kwh", "units", "amount", "due_date", "paid_date", "notes"],
        rows.map(({ meter, account, b }) => [meter, account, b.billDate, b.readingDate, b.previousReading, b.currentReading, b.units, b.amount, b.dueDate, b.paidDate, b.notes]),
      );
    },
  },
  bills: {
    label: "Bills and subscriptions",
    group: "Bills",
    async build() {
      const rows = await db.select().from(billItems).orderBy(asc(billItems.name));
      return toCsv(
        ["name", "type", "how_often", "next_due", "day_of_month", "usual_amount", "autopay", "paid_with", "archived", "notes"],
        rows.map((i) => [i.name, i.kind, i.frequency, i.nextDueDate, i.anchorDay, i.amount, i.autopay, i.paymentMethod, i.archivedAt !== null, i.notes]),
      );
    },
  },
  "bill-payments": {
    label: "Bill payments",
    group: "Bills",
    async build() {
      const rows = await db
        .select({ name: billItems.name, p: billPayments })
        .from(billPayments)
        .innerJoin(billItems, eq(billItems.id, billPayments.itemId))
        .orderBy(asc(billItems.name), asc(billPayments.paidDate));
      return toCsv(["bill", "was_due", "paid_on", "amount", "note"], rows.map(({ name, p }) => [name, p.dueDate, p.paidDate, p.amount, p.note]));
    },
  },
  vehicles: {
    label: "Vehicles",
    group: "Vehicles",
    async build() {
      const rows = await db.select().from(vehicles).orderBy(asc(vehicles.nickname));
      return toCsv(
        ["name", "plate", "type", "make", "model", "year", "fuel", "archived"],
        rows.map((v) => [v.nickname, v.registrationNumber, v.vehicleType, v.make, v.model, v.year, v.fuelType, v.archivedAt !== null]),
      );
    },
  },
  "vehicle-renewals": {
    label: "Renewals",
    group: "Vehicles",
    async build() {
      const rows = await db
        .select({ vehicle: vehicles.nickname, r: vehicleRenewals })
        .from(vehicleRenewals)
        .innerJoin(vehicles, eq(vehicles.id, vehicleRenewals.vehicleId))
        .orderBy(asc(vehicles.nickname), asc(vehicleRenewals.expiryDate));
      return toCsv(
        ["vehicle", "renewal", "provider", "start", "expiry", "amount", "renewed"],
        rows.map(({ vehicle, r }) => [vehicle, r.type, r.provider, r.startDate, r.expiryDate, r.amount, r.renewedAt !== null]),
      );
    },
  },
  "vehicle-services": {
    label: "Services",
    group: "Vehicles",
    async build() {
      const rows = await db
        .select({ vehicle: vehicles.nickname, s: vehicleServices })
        .from(vehicleServices)
        .innerJoin(vehicles, eq(vehicles.id, vehicleServices.vehicleId))
        .orderBy(asc(vehicles.nickname), asc(vehicleServices.serviceDate));
      return toCsv(
        ["vehicle", "date", "service", "garage", "odometer_km", "cost", "work_done", "next_due"],
        rows.map(({ vehicle, s }) => [vehicle, s.serviceDate, s.serviceType, s.garage, s.odometerKm, s.cost, s.itemsDone, s.nextDueDate]),
      );
    },
  },
} as const;

export type ExportKey = keyof typeof EXPORTS;

export function isExportKey(value: string): value is ExportKey {
  return Object.hasOwn(EXPORTS, value);
}

export async function buildExport(key: ExportKey): Promise<string> {
  await connection();
  return EXPORTS[key].build();
}

"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { electricityBills, electricityMeters, electricityReadings } from "@/db/schema";
import { toActionState } from "@/features/shared/errors";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { toCents } from "@/lib/decimal";
import { isValidDate } from "@/lib/dates";
import { todayInAppTz } from "@/lib/format";
import { parseBill } from "./bill-validate";
import { checkReadingFits, toReading } from "./usage";
import { parseMeter, parseReading } from "./validate";
import { requireUser } from "@/lib/auth";

// Server Actions are public HTTP endpoints, so every input is validated here.

function raw(fd: FormData, keys: string[]) {
  const out: Record<string, string | undefined> = {};
  for (const k of keys) {
    const v = fd.get(k);
    out[k] = typeof v === "string" ? v : undefined;
  }
  return out;
}

function meterFields(fd: FormData) {
  const r = parseMeter(raw(fd, ["name", "accountNumber", "notes"]));
  if (!r.ok) throw new ValidationError(r.error);
  return r.value;
}

export async function createMeter(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser();
    await db.insert(electricityMeters).values(meterFields(fd));
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function updateMeter(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser();
    await db.update(electricityMeters).set(meterFields(fd)).where(eq(electricityMeters.id, idFrom(fd)));
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function archiveMeter(fd: FormData): Promise<void> {
  await requireUser();
  await db.update(electricityMeters).set({ archivedAt: new Date() }).where(eq(electricityMeters.id, idFrom(fd)));
  refresh();
}

export async function unarchiveMeter(fd: FormData): Promise<void> {
  await requireUser();
  await db.update(electricityMeters).set({ archivedAt: null }).where(eq(electricityMeters.id, idFrom(fd)));
  refresh();
}

/** Permanent: the meter and (by cascade) all its readings and bills. */
export async function deleteMeter(fd: FormData): Promise<void> {
  await requireUser();
  const id = idFrom(fd);
  await db.delete(electricityMeters).where(eq(electricityMeters.id, id));
  refresh();
}

/** Parses the form, checks the reading fits among the meter's other readings, returns the row to save. */
async function readingToSave(fd: FormData, meterId: string, editingId?: string) {
  const parsed = parseReading(raw(fd, ["readingDate", "value", "note", "replaced", "replacedFinalValue"]));
  if (!parsed.ok) throw new ValidationError(parsed.error);
  const f = parsed.value;

  const others = (await db.select().from(electricityReadings).where(eq(electricityReadings.meterId, meterId)))
    .filter((r) => r.id !== editingId)
    .map(toReading);
  const fit = checkReadingFits(others, {
    date: f.readingDate,
    value: toCents(f.value),
    replacedFinal: f.replacedFinalValue === null ? null : toCents(f.replacedFinalValue),
    createdAt: new Date(),
  });
  if (!fit.ok) throw new ValidationError(fit.error);
  return f;
}

export async function addReading(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser();
    const meterId = idFrom(fd, "meterId");
    const [meter] = await db.select({ id: electricityMeters.id }).from(electricityMeters).where(eq(electricityMeters.id, meterId));
    if (!meter) throw new ValidationError("That meter could not be found.");
    const f = await readingToSave(fd, meterId);
    await db.insert(electricityReadings).values({ meterId, ...f, source: "manual" });
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function updateReading(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser();
    const id = idFrom(fd);
    const [existing] = await db.select().from(electricityReadings).where(eq(electricityReadings.id, id));
    if (!existing) throw new ValidationError("That reading could not be found.");
    const f = await readingToSave(fd, existing.meterId, id);
    await db.update(electricityReadings).set(f).where(eq(electricityReadings.id, id));
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function deleteReading(fd: FormData): Promise<void> {
  await requireUser();
  await db.delete(electricityReadings).where(eq(electricityReadings.id, idFrom(fd)));
  refresh();
}

// ---- Bills ----

const BILL_KEYS = ["billDate", "readingDate", "previousReading", "currentReading", "units", "amount", "dueDate", "paidDate", "notes"];

function billFields(fd: FormData) {
  const r = parseBill(raw(fd, BILL_KEYS));
  if (!r.ok) throw new ValidationError(r.error);
  return r.value;
}

export async function createBill(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser();
    const meterId = idFrom(fd, "meterId");
    const [meter] = await db.select({ id: electricityMeters.id }).from(electricityMeters).where(eq(electricityMeters.id, meterId));
    if (!meter) throw new ValidationError("That meter could not be found.");
    await db.insert(electricityBills).values({ meterId, ...billFields(fd) });
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function updateBill(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser();
    await db.update(electricityBills).set(billFields(fd)).where(eq(electricityBills.id, idFrom(fd)));
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

/** Permanent: the bill. */
export async function deleteBill(fd: FormData): Promise<void> {
  await requireUser();
  const id = idFrom(fd);
  await db.delete(electricityBills).where(eq(electricityBills.id, id));
  refresh();
}

/** Marks a bill paid on the given date (today in the app time zone when left empty). An invalid date is ignored. */
export async function markBillPaid(fd: FormData): Promise<void> {
  await requireUser();
  const given = fd.get("paidDate");
  const paidDate = typeof given === "string" && given.trim() ? given.trim() : todayInAppTz();
  if (!isValidDate(paidDate)) return;
  await db.update(electricityBills).set({ paidDate }).where(eq(electricityBills.id, idFrom(fd)));
  refresh();
}

export async function markBillUnpaid(fd: FormData): Promise<void> {
  await requireUser();
  await db.update(electricityBills).set({ paidDate: null }).where(eq(electricityBills.id, idFrom(fd)));
  refresh();
}

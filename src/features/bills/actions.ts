"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { billItems } from "@/db/schema";
import { deleteSharedDataOf } from "@/features/shared/cleanup";
import { toActionState } from "@/features/shared/errors";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { anchorDayOf } from "./schedule";
import { parseBillItem } from "./validate";

// Server Actions are public HTTP endpoints, so every input is validated here.

const KEYS = ["kind", "name", "frequency", "nextDueDate", "amount", "autopay", "paymentMethod", "notes"];

function fieldsFrom(fd: FormData) {
  const raw: Record<string, string | undefined> = {};
  for (const k of KEYS) {
    const v = fd.get(k);
    raw[k] = typeof v === "string" ? v : undefined;
  }
  const r = parseBillItem(raw);
  if (!r.ok) throw new ValidationError(r.error);
  return r.value;
}

export async function createBillItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = fieldsFrom(fd);
    await db.insert(billItems).values({ ...f, anchorDay: anchorDayOf(f.nextDueDate) });
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function updateBillItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const id = idFrom(fd);
    const f = fieldsFrom(fd);
    const [existing] = await db.select().from(billItems).where(eq(billItems.id, id));
    if (!existing) throw new ValidationError("That item could not be found.");
    // Saving other details must not move the anchor: a bill due on the 31st that is showing Feb 28
    // keeps coming back to the 31st. Only an edited due date sets a new anchor day.
    const anchorDay = existing.nextDueDate === f.nextDueDate && existing.anchorDay ? existing.anchorDay : anchorDayOf(f.nextDueDate);
    await db.update(billItems).set({ ...f, anchorDay }).where(eq(billItems.id, id));
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function archiveBillItem(fd: FormData): Promise<void> {
  await db.update(billItems).set({ archivedAt: new Date() }).where(eq(billItems.id, idFrom(fd)));
  refresh();
}

export async function unarchiveBillItem(fd: FormData): Promise<void> {
  await db.update(billItems).set({ archivedAt: null }).where(eq(billItems.id, idFrom(fd)));
  refresh();
}

/** Permanent: the item and its documents. */
export async function deleteBillItem(fd: FormData): Promise<void> {
  const id = idFrom(fd);
  await deleteSharedDataOf("bill_item", id);
  await db.delete(billItems).where(eq(billItems.id, id));
  refresh();
}

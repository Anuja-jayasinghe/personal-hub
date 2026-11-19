"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { billItems, billPayments } from "@/db/schema";
import { deleteAttachmentsOf, deleteSharedDataOf } from "@/features/shared/cleanup";
import { toActionState } from "@/features/shared/errors";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { applyPayment, dueAfterUndo } from "./payments";
import { anchorDayOf } from "./schedule";
import { parseBillItem, parsePayment } from "./validate";
import { requireUser } from "@/lib/auth";
import { todayInAppTz } from "@/lib/format";

// Server Actions are public HTTP endpoints, so every input is validated here.

const KEYS = ["kind", "name", "frequency", "nextDueDate", "billDay", "amount", "autopay", "paymentMethod", "notes"];

function fieldsFrom(fd: FormData) {
  const raw: Record<string, string | undefined> = {};
  for (const k of KEYS) {
    const v = fd.get(k);
    raw[k] = typeof v === "string" ? v : undefined;
  }
  const r = parseBillItem(raw, todayInAppTz());
  if (!r.ok) throw new ValidationError(r.error);
  return r.value;
}

export async function createBillItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "bills", level: "add" });
    const f = fieldsFrom(fd);
    await db.insert(billItems).values({ ...f, anchorDay: f.anchorDay ?? anchorDayOf(f.nextDueDate) });
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function updateBillItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "bills", level: "edit" });
    const id = idFrom(fd);
    const f = fieldsFrom(fd);
    const [existing] = await db.select().from(billItems).where(eq(billItems.id, id));
    if (!existing) throw new ValidationError("That item could not be found.");
    // Saving other details must not move the anchor: a bill due on the 31st that is showing Feb 28
    // keeps coming back to the 31st. Only an edited due date sets a new anchor day.
    if (f.anchorDay !== undefined) {
      // Entered by its bill day (S.5): an unchanged day keeps the current due date (it may already be
      // a later month after a payment); a new day sets a new due date.
      const same = existing.frequency === "monthly" && existing.anchorDay === f.anchorDay && existing.nextDueDate;
      await db
        .update(billItems)
        .set({ ...f, nextDueDate: same ? existing.nextDueDate! : f.nextDueDate, anchorDay: f.anchorDay })
        .where(eq(billItems.id, id));
    } else {
      const anchorDay = existing.nextDueDate === f.nextDueDate && existing.anchorDay ? existing.anchorDay : anchorDayOf(f.nextDueDate);
      await db.update(billItems).set({ ...f, anchorDay }).where(eq(billItems.id, id));
    }
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function archiveBillItem(fd: FormData): Promise<void> {
  await requireUser({ area: "bills", level: "edit" });
  await db.update(billItems).set({ archivedAt: new Date() }).where(eq(billItems.id, idFrom(fd)));
  refresh();
}

export async function unarchiveBillItem(fd: FormData): Promise<void> {
  await requireUser({ area: "bills", level: "edit" });
  await db.update(billItems).set({ archivedAt: null }).where(eq(billItems.id, idFrom(fd)));
  refresh();
}

/** Permanent: the item and its documents. */
export async function deleteBillItem(fd: FormData): Promise<void> {
  await requireUser({ area: "bills", level: "edit" });
  const id = idFrom(fd);
  // Receipts are attachments owned by each payment, which the database cannot cascade to.
  const payments = await db.select({ id: billPayments.id }).from(billPayments).where(eq(billPayments.itemId, id));
  for (const p of payments) await deleteAttachmentsOf("bill_payment", p.id);
  await deleteSharedDataOf("bill_item", id);
  await db.delete(billItems).where(eq(billItems.id, id));
  refresh();
}

// ---- Payments ----

function paymentFields(fd: FormData) {
  const raw: Record<string, string | undefined> = {};
  for (const k of ["paidDate", "amount", "note"]) {
    const v = fd.get(k);
    raw[k] = typeof v === "string" ? v : undefined;
  }
  const r = parsePayment(raw);
  if (!r.ok) throw new ValidationError(r.error);
  return r.value;
}

/**
 * "Mark paid": records a payment for the item's current due date and moves the due date forward
 * by the frequency (a one-off item is finished), in one transaction. The item row is locked while
 * this runs, so a double click cannot pay two periods.
 */
export async function markBillItemPaid(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "bills", level: "add" });
    const itemId = idFrom(fd, "itemId");
    const f = paymentFields(fd);
    await db.transaction(async (tx) => {
      const [item] = await tx.select().from(billItems).where(eq(billItems.id, itemId)).for("update");
      if (!item) throw new ValidationError("That item could not be found.");
      if (item.archivedAt) throw new ValidationError("Unarchive this item before recording a payment.");
      const paid = applyPayment(item);
      if (!paid.ok) throw new ValidationError(paid.error);
      await tx.insert(billPayments).values({ itemId, dueDate: paid.settles, ...f });
      await tx.update(billItems).set({ nextDueDate: paid.nextDueDate }).where(eq(billItems.id, itemId));
    });
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

/** Edits what was recorded (date, amount, note). It does not move the item's due date. */
export async function updateBillPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "bills", level: "edit" });
    await db.update(billPayments).set(paymentFields(fd)).where(eq(billPayments.id, idFrom(fd)));
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

/**
 * Deletes a payment and its receipts. If it was the most recently recorded payment, the item goes
 * back to due on the date that payment settled (see `dueAfterUndo`).
 */
export async function deleteBillPayment(fd: FormData): Promise<void> {
  await requireUser({ area: "bills", level: "edit" });
  const id = idFrom(fd);
  await deleteAttachmentsOf("bill_payment", id);
  await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(billPayments).where(eq(billPayments.id, id));
    if (!payment) return;
    const [item] = await tx.select().from(billItems).where(eq(billItems.id, payment.itemId)).for("update");
    const all = await tx.select().from(billPayments).where(eq(billPayments.itemId, payment.itemId));
    await tx.delete(billPayments).where(eq(billPayments.id, id));
    const restored = item ? dueAfterUndo(all, id, payment.dueDate, item.nextDueDate) : null;
    if (restored) await tx.update(billItems).set({ nextDueDate: restored }).where(eq(billItems.id, payment.itemId));
  });
  refresh();
}

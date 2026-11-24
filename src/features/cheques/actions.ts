"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { cheques } from "@/db/schema";
import { deleteSharedDataOf } from "@/features/shared/cleanup";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { requireUser } from "@/lib/auth";
import { safeErrorSummary } from "@/lib/errors";
import { todayInAppTz } from "@/lib/format";
import { canMove } from "./logic";
import { depositedOnAfter, parseCheque, parseStatusChange } from "./validate";

// Cheques are owners only (issue #178, C158): every action asks for "owner" first. Server Actions are
// public HTTP endpoints, so every input is validated here, and no message repeats what was typed.

/**
 * An error as the form's result. Unlike `toActionState` it never logs the error itself: a failed query's
 * message carries its parameters, which here are a name, an amount and a cheque number (issue #178).
 */
function failure(err: unknown): ActionState {
  if (err instanceof ValidationError) return { ok: false, error: err.message };
  console.error(`Cheque action failed: ${safeErrorSummary(err)}`);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const KEYS = ["fromParty", "amount", "bank", "chequeNumber", "chequeDate", "note"];

function rawFrom(fd: FormData, keys: readonly string[]) {
  const raw: Record<string, string | undefined> = {};
  for (const k of keys) {
    const v = fd.get(k);
    raw[k] = typeof v === "string" ? v : undefined;
  }
  return raw;
}

export async function createCheque(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser("owner");
    const r = parseCheque(rawFrom(fd, KEYS), todayInAppTz());
    if (!r.ok) throw new ValidationError(r.error);
    await db.insert(cheques).values(r.value);
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function updateCheque(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser("owner");
    const id = idFrom(fd);
    const [existing] = await db.select().from(cheques).where(eq(cheques.id, id));
    if (!existing) throw new ValidationError("That cheque could not be found.");
    const r = parseCheque(rawFrom(fd, KEYS), todayInAppTz(), existing.chequeDate);
    if (!r.ok) throw new ValidationError(r.error);
    await db.update(cheques).set(r.value).where(eq(cheques.id, id));
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Moves a cheque to another status (the one place that does): waiting to deposited (with the deposit date),
 * on to cleared, or ending as bounced or cancelled, and back to waiting to correct a mistake. The update only
 * applies if the status is still the one that was read, so two taps at once cannot both win.
 */
export async function setChequeStatus(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser("owner");
    const id = idFrom(fd);
    const change = parseStatusChange(rawFrom(fd, ["status", "depositedOn"]), todayInAppTz());
    if (!change.ok) throw new ValidationError(change.error);
    const [existing] = await db.select().from(cheques).where(eq(cheques.id, id));
    if (!existing) throw new ValidationError("That cheque could not be found.");
    if (!canMove(existing.status, change.value.status)) throw new ValidationError("That cheque cannot move to that status from where it is. Reload the page.");
    const updated = await db
      .update(cheques)
      .set({ status: change.value.status, depositedOn: depositedOnAfter(change.value.status, change.value, existing.depositedOn) })
      .where(and(eq(cheques.id, id), eq(cheques.status, existing.status)))
      .returning({ id: cheques.id });
    if (updated.length === 0) throw new ValidationError("That cheque changed in the meantime. Reload the page.");
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

/** Permanent: the cheque and its photos. */
export async function deleteCheque(fd: FormData): Promise<void> {
  await requireUser("owner");
  const id = idFrom(fd);
  // The photos are attachments the database cannot cascade to: files in storage first, then the rows.
  await deleteSharedDataOf("cheque", id);
  await db.delete(cheques).where(eq(cheques.id, id));
  refresh();
}

"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { attachments, notes, tasks, TASK_PRIORITIES, TASK_STATUSES } from "@/db/schema";
import { deleteAttachmentsOf } from "./cleanup";
import { toActionState as failure } from "./errors";
import { removeAttachment, storeAttachment } from "./files";
import type { ActionState } from "./types";
import { requireUser } from "@/lib/auth";
import {
  idFrom,
  oneOf,
  optionalDate,
  optionalMoney,
  optionalOwner,
  optionalText,
  requiredOwner,
  requiredText,
  ValidationError,
} from "./validation";

// Server Actions are public HTTP endpoints, so every input is validated here, never trusted from
// the form. Form actions return { ok, error } for useActionState; plain-form actions return void.

// ---------------------------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------------------------

function taskFields(fd: FormData) {
  return {
    title: requiredText(fd, "title", "Title", 200),
    details: optionalText(fd, "details", "Details", 5000),
    priority: oneOf(fd, "priority", "Priority", TASK_PRIORITIES),
    dueDate: optionalDate(fd, "dueDate", "Due date"),
    estimatedCost: optionalMoney(fd, "estimatedCost", "Estimated cost"),
    actualCost: optionalMoney(fd, "actualCost", "Actual cost"),
  };
}

export async function createTask(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser();
    const owner = optionalOwner(fd);
    await db.insert(tasks).values({
      ...taskFields(fd),
      ownerType: owner?.ownerType ?? null,
      ownerId: owner?.ownerId ?? null,
    });
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function updateTask(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser();
    await db.update(tasks).set(taskFields(fd)).where(eq(tasks.id, idFrom(fd)));
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function setTaskStatus(fd: FormData): Promise<void> {
  await requireUser();
  const status = oneOf(fd, "status", "Status", TASK_STATUSES);
  await db
    .update(tasks)
    .set({ status, completedAt: status === "done" ? new Date() : null })
    .where(eq(tasks.id, idFrom(fd)));
  refresh();
}

export async function deleteTask(fd: FormData): Promise<void> {
  await requireUser();
  const id = idFrom(fd);
  await deleteAttachmentsOf("task", id);
  await db.delete(tasks).where(eq(tasks.id, id));
  refresh();
}

// ---------------------------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------------------------

function noteFields(fd: FormData) {
  return {
    title: optionalText(fd, "title", "Title", 200),
    body: requiredText(fd, "body", "Note", 20000),
  };
}

export async function createNote(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser();
    const owner = optionalOwner(fd);
    await db.insert(notes).values({
      ...noteFields(fd),
      ownerType: owner?.ownerType ?? null,
      ownerId: owner?.ownerId ?? null,
    });
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function updateNote(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser();
    await db.update(notes).set(noteFields(fd)).where(eq(notes.id, idFrom(fd)));
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function toggleNotePinned(fd: FormData): Promise<void> {
  await requireUser();
  const id = idFrom(fd);
  const pinned = fd.get("pinned") === "true";
  await db.update(notes).set({ pinned }).where(eq(notes.id, id));
  refresh();
}

export async function deleteNote(fd: FormData): Promise<void> {
  await requireUser();
  const id = idFrom(fd);
  await deleteAttachmentsOf("note", id);
  await db.delete(notes).where(eq(notes.id, id));
  refresh();
}

// ---------------------------------------------------------------------------------------------
// Attachments (files live in the private Supabase Storage bucket)
// ---------------------------------------------------------------------------------------------

export async function uploadAttachment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser();
    const owner = requiredOwner(fd);
    const file = fd.get("file");
    if (!(file instanceof File)) throw new ValidationError("Choose a file to upload.");
    await storeAttachment(owner, file);
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteAttachment(fd: FormData): Promise<void> {
  await requireUser();
  const id = idFrom(fd);
  const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
  if (!row) return;
  await removeAttachment(row);
  refresh();
}

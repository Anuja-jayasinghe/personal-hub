"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { attachments, notes, tasks, TASK_PRIORITIES, TASK_STATUSES } from "@/db/schema";
import { deleteAttachmentsOf } from "./cleanup";
import { toActionState as failure } from "./errors";
import { recordUpload, removeAttachment, uploadedFrom } from "./files";
import type { ActionState } from "./types";
import { areaOfFile, areaOfOwner, type Level } from "@/features/people/access";
import { fileArea } from "@/features/people/file-area";
import { isOwnerType } from "@/lib/owners";
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

/**
 * Tasks, notes and files attached to a record also need its section (S.8, C114): a person who cannot
 * see Vehicles cannot add a note to a vehicle, nor change one that is there.
 */
async function requireOwnerSection(owner: { ownerType: string | null; ownerId: string | null } | null | undefined, level: Level) {
  if (!owner?.ownerType || !isOwnerType(owner.ownerType)) return;
  await requireUser({ area: areaOfOwner(owner.ownerType), level });
}

async function ownerOf(table: typeof tasks | typeof notes | typeof attachments, id: string) {
  const [row] = await db.select({ ownerType: table.ownerType, ownerId: table.ownerId }).from(table).where(eq(table.id, id));
  if (!row) throw new ValidationError("That item could not be found.");
  return row;
}

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
    await requireUser({ area: "tasks_notes", level: "add" });
    const owner = optionalOwner(fd);
    await requireOwnerSection(owner, "see");
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
    await requireUser({ area: "tasks_notes", level: "edit" });
    const id = idFrom(fd);
    await requireOwnerSection(await ownerOf(tasks, id), "see");
    await db.update(tasks).set(taskFields(fd)).where(eq(tasks.id, id));
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function setTaskStatus(fd: FormData): Promise<void> {
  await requireUser({ area: "tasks_notes", level: "edit" });
  await requireOwnerSection(await ownerOf(tasks, idFrom(fd)), "see");
  const status = oneOf(fd, "status", "Status", TASK_STATUSES);
  await db
    .update(tasks)
    .set({ status, completedAt: status === "done" ? new Date() : null })
    .where(eq(tasks.id, idFrom(fd)));
  refresh();
}

export async function deleteTask(fd: FormData): Promise<void> {
  await requireUser({ area: "tasks_notes", level: "edit" });
  const id = idFrom(fd);
  await requireOwnerSection(await ownerOf(tasks, id), "see");
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
    await requireUser({ area: "tasks_notes", level: "add" });
    const owner = optionalOwner(fd);
    await requireOwnerSection(owner, "see");
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
    await requireUser({ area: "tasks_notes", level: "edit" });
    const id = idFrom(fd);
    await requireOwnerSection(await ownerOf(notes, id), "see");
    await db.update(notes).set(noteFields(fd)).where(eq(notes.id, id));
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function toggleNotePinned(fd: FormData): Promise<void> {
  await requireUser({ area: "tasks_notes", level: "edit" });
  const id = idFrom(fd);
  await requireOwnerSection(await ownerOf(notes, id), "see");
  const pinned = fd.get("pinned") === "true";
  await db.update(notes).set({ pinned }).where(eq(notes.id, id));
  refresh();
}

export async function deleteNote(fd: FormData): Promise<void> {
  await requireUser({ area: "tasks_notes", level: "edit" });
  const id = idFrom(fd);
  await requireOwnerSection(await ownerOf(notes, id), "see");
  await deleteAttachmentsOf("note", id);
  await db.delete(notes).where(eq(notes.id, id));
  refresh();
}

// ---------------------------------------------------------------------------------------------
// Attachments (files live in the private Supabase Storage bucket)
// ---------------------------------------------------------------------------------------------

export async function uploadAttachment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser("signed-in");
    const owner = requiredOwner(fd);
    // The section the file will belong to, not just its record's: a file on a vehicle or a renewal is a
    // Vehicle document (C114), so it needs Add there.
    await requireUser({ area: areaOfFile(owner.ownerType), level: "add" });
    // The browser has already put the file in storage (C115); this records it after checking it.
    await recordUpload(owner, uploadedFrom(fd));
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteAttachment(fd: FormData): Promise<void> {
  await requireUser("signed-in");
  const id = idFrom(fd);
  const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
  if (!row) return;
  // Edit in the section the file belongs to: Vehicle documents for a vehicle's papers, Vehicles for its cover.
  await requireUser({ area: await fileArea(row), level: "edit" });
  await removeAttachment(row);
  refresh();
}

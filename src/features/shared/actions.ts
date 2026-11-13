"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { attachments, notes, tasks, TASK_PRIORITIES, TASK_STATUSES } from "@/db/schema";
import { ATTACHMENT_BUCKET, ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, resolveMimeType, storageClient } from "@/lib/storage";
import { deleteAttachmentsOf } from "./cleanup";
import type { ActionState } from "./types";
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

function failure(err: unknown): ActionState {
  if (err instanceof ValidationError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
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
    await db.update(tasks).set(taskFields(fd)).where(eq(tasks.id, idFrom(fd)));
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function setTaskStatus(fd: FormData): Promise<void> {
  const status = oneOf(fd, "status", "Status", TASK_STATUSES);
  await db
    .update(tasks)
    .set({ status, completedAt: status === "done" ? new Date() : null })
    .where(eq(tasks.id, idFrom(fd)));
  refresh();
}

export async function deleteTask(fd: FormData): Promise<void> {
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
    await db.update(notes).set(noteFields(fd)).where(eq(notes.id, idFrom(fd)));
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function toggleNotePinned(fd: FormData): Promise<void> {
  const id = idFrom(fd);
  const pinned = fd.get("pinned") === "true";
  await db.update(notes).set({ pinned }).where(eq(notes.id, id));
  refresh();
}

export async function deleteNote(fd: FormData): Promise<void> {
  const id = idFrom(fd);
  await deleteAttachmentsOf("note", id);
  await db.delete(notes).where(eq(notes.id, id));
  refresh();
}

// ---------------------------------------------------------------------------------------------
// Attachments (files live in the private Supabase Storage bucket)
// ---------------------------------------------------------------------------------------------

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(-120);
  return cleaned || "file";
}

export async function uploadAttachment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const owner = requiredOwner(fd);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose a file to upload.");
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new ValidationError(`File is too large. The limit is ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`);
    }
    const mimeType = resolveMimeType(file);
    if (!(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(mimeType)) {
      throw new ValidationError("Only JPEG, PNG, WebP, HEIC images and PDF files are allowed.");
    }

    const storagePath = `${owner.ownerType}/${owner.ownerId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const storage = storageClient().storage.from(ATTACHMENT_BUCKET);
    const { error: uploadError } = await storage.upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: mimeType,
    });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    try {
      await db.insert(attachments).values({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        bucket: ATTACHMENT_BUCKET,
        storagePath,
        fileName: file.name.slice(0, 255),
        mimeType,
        sizeBytes: file.size,
      });
    } catch (dbError) {
      await storage.remove([storagePath]); // don't leave an orphaned file behind
      throw dbError;
    }
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteAttachment(fd: FormData): Promise<void> {
  const id = idFrom(fd);
  const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
  if (!row) return;

  const { error } = await storageClient().storage.from(row.bucket).remove([row.storagePath]);
  if (error) throw new Error(`Could not delete file: ${error.message}`);
  await db.delete(attachments).where(eq(attachments.id, id));
  refresh();
}

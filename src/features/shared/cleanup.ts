import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments, notes, tasks } from "@/db/schema";
import type { OwnerType } from "@/lib/owners";
import { ATTACHMENT_BUCKET, storageClient } from "@/lib/storage";

/** Deletes every attachment of one owner: the files in storage first, then the rows. */
export async function deleteAttachmentsOf(ownerType: OwnerType, ownerId: string): Promise<void> {
  const rows = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.ownerType, ownerType), eq(attachments.ownerId, ownerId)));
  if (rows.length === 0) return;

  const { error } = await storageClient()
    .storage.from(ATTACHMENT_BUCKET)
    .remove(rows.map((r) => r.storagePath));
  if (error) throw new Error(`Could not delete files: ${error.message}`);

  await db
    .delete(attachments)
    .where(and(eq(attachments.ownerType, ownerType), eq(attachments.ownerId, ownerId)));
}

/**
 * Owners are polymorphic (no foreign keys), so when a record such as a vehicle is deleted, its
 * tasks, notes and attachments must be deleted in code. Every module's delete action calls this.
 */
export async function deleteSharedDataOf(ownerType: OwnerType, ownerId: string): Promise<void> {
  const ownedTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.ownerType, ownerType), eq(tasks.ownerId, ownerId)));
  const ownedNotes = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.ownerType, ownerType), eq(notes.ownerId, ownerId)));

  for (const t of ownedTasks) await deleteAttachmentsOf("task", t.id);
  for (const n of ownedNotes) await deleteAttachmentsOf("note", n.id);
  await deleteAttachmentsOf(ownerType, ownerId);

  await db.delete(tasks).where(and(eq(tasks.ownerType, ownerType), eq(tasks.ownerId, ownerId)));
  await db.delete(notes).where(and(eq(notes.ownerType, ownerType), eq(notes.ownerId, ownerId)));
}

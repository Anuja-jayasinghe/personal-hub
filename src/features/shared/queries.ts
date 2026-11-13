import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { attachments, notes, tasks, type Attachment } from "@/db/schema";
import type { OwnerRef, OwnerType } from "@/lib/owners";

/**
 * Which items to load: only standalone ones, those belonging to one record, or everything.
 * Panels take a scope so any module page can reuse them (e.g. `{ kind: "owner", owner }` on a
 * vehicle page) and the Tasks & notes page can show items from every module.
 */
export type OwnerScope =
  | { kind: "standalone" }
  | { kind: "owner"; owner: OwnerRef }
  | { kind: "all" };

// Every query starts with connection(): database reads must happen at request time, never while
// pre-rendering (Next.js cache components).

export async function listTasks(scope: OwnerScope) {
  await connection();
  const where =
    scope.kind === "standalone"
      ? isNull(tasks.ownerType)
      : scope.kind === "owner"
        ? and(eq(tasks.ownerType, scope.owner.ownerType), eq(tasks.ownerId, scope.owner.ownerId))
        : undefined;

  return db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(
      sql`(${tasks.status} = 'done')`, // open tasks first
      sql`case ${tasks.priority} when 'high' then 0 when 'normal' then 1 else 2 end`,
      sql`${tasks.dueDate} asc nulls last`,
      desc(tasks.createdAt),
    );
}

export async function listNotes(scope: OwnerScope) {
  await connection();
  const where =
    scope.kind === "standalone"
      ? isNull(notes.ownerType)
      : scope.kind === "owner"
        ? and(eq(notes.ownerType, scope.owner.ownerType), eq(notes.ownerId, scope.owner.ownerId))
        : undefined;

  return db.select().from(notes).where(where).orderBy(desc(notes.pinned), desc(notes.updatedAt));
}

/** Attachments for many owners of one type in a single query, grouped by owner id. */
export async function attachmentsByOwner(
  ownerType: OwnerType,
  ownerIds: string[],
): Promise<Map<string, Attachment[]>> {
  await connection();
  const grouped = new Map<string, Attachment[]>();
  if (ownerIds.length === 0) return grouped;

  const rows = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.ownerType, ownerType), inArray(attachments.ownerId, ownerIds)))
    .orderBy(attachments.createdAt);

  for (const row of rows) {
    const list = grouped.get(row.ownerId) ?? [];
    list.push(row);
    grouped.set(row.ownerId, list);
  }
  return grouped;
}

export async function getAttachment(id: string) {
  await connection();
  const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
  return row ?? null;
}

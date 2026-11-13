import { bigint, boolean, check, date, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, updatedAt } from "./_columns";

export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export const TASK_PRIORITIES = ["low", "normal", "high"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/**
 * Tasks. `owner_type` + `owner_id` point at the record a task belongs to (a vehicle, a meter, ...);
 * both are null for a standalone task. See src/lib/owners.ts. Row-level security on (C27).
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: text("owner_type"),
    ownerId: uuid("owner_id"),
    title: text("title").notNull(),
    details: text("details"),
    status: text("status").$type<TaskStatus>().notNull().default("todo"),
    priority: text("priority").$type<TaskPriority>().notNull().default("normal"),
    /** Calendar date (no time zone), as "YYYY-MM-DD". */
    dueDate: date("due_date", { mode: "string" }),
    estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }),
    actualCost: numeric("actual_cost", { precision: 12, scale: 2 }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tasks_owner_idx").on(t.ownerType, t.ownerId),
    index("tasks_status_due_idx").on(t.status, t.dueDate),
    check("tasks_status_check", sql`${t.status} in ('todo', 'doing', 'done')`),
    check("tasks_priority_check", sql`${t.priority} in ('low', 'normal', 'high')`),
    check("tasks_owner_pair_check", sql`(${t.ownerType} is null) = (${t.ownerId} is null)`),
  ],
).enableRLS();

/** Notes. Same owner convention as tasks: both owner columns null = standalone note. */
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: text("owner_type"),
    ownerId: uuid("owner_id"),
    title: text("title"),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("notes_owner_idx").on(t.ownerType, t.ownerId),
    check("notes_owner_pair_check", sql`(${t.ownerType} is null) = (${t.ownerId} is null)`),
  ],
).enableRLS();

/**
 * Attachment metadata. The file itself lives in a private Supabase Storage bucket
 * (DECISIONS C33); only its path and details are stored here. An attachment always has an owner
 * (a record, or a task/note for standalone items).
 */
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    bucket: text("bucket").notNull().default("attachments"),
    storagePath: text("storage_path").notNull().unique(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("attachments_owner_idx").on(t.ownerType, t.ownerId),
    check("attachments_size_check", sql`${t.sizeBytes} >= 0`),
  ],
).enableRLS();

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

import { sql } from "drizzle-orm";
import { check, date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./_columns";

/**
 * The send log of notifications (Notifications N.1, DECISIONS C139): one row per notice (item, step,
 * recipient). Row-level security on (C27).
 *
 * A row is written as `pending` BEFORE a real send and stamped `sent` (or `failed`) after, so a crash
 * can never send twice: the partial unique index makes a second real row for the same recipient and
 * dedupe key impossible. A dry run (a channel not built or not switched on) writes `dry_run` rows,
 * which have their own unique index and never block a later real send of the same key.
 * The daily run deletes rows older than a year.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Lower-cased email of the person it is for. */
    recipient: text("recipient").notNull(),
    /** `<item id>:<step>:<due date>`. */
    dedupeKey: text("dedupe_key").notNull(),
    channel: text("channel").$type<"email" | "push">().notNull(),
    /** The event, e.g. "renewal", "electricity-bill" (src/features/notifications/steps.ts). */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: text("status").$type<"dry_run" | "pending" | "sent" | "failed">().notNull(),
    error: text("error"),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    check("notifications_channel_check", sql`${t.channel} in ('email', 'push')`),
    check("notifications_status_check", sql`${t.status} in ('dry_run', 'pending', 'sent', 'failed')`),
    check("notifications_recipient_check", sql`${t.recipient} = lower(${t.recipient})`),
    check("notifications_sent_at_check", sql`${t.status} <> 'sent' or ${t.sentAt} is not null`),
    // A real notice (pending, sent or failed) exists at most once per recipient and key: no repeats, ever.
    uniqueIndex("notifications_real_once").on(t.recipient, t.dedupeKey).where(sql`${t.status} <> 'dry_run'`),
    // A dry run logs each notice once too, without blocking the real send later.
    uniqueIndex("notifications_dry_run_once").on(t.recipient, t.dedupeKey).where(sql`${t.status} = 'dry_run'`),
    // "Recently sent" in Settings, and the run's look at a recipient's log.
    index("notifications_recent_idx").on(t.createdAt.desc()),
  ],
).enableRLS();

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;

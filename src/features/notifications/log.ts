import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/read";
import { notifications } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import type { ChannelMode, ChannelModes, ChannelSender } from "./channels";
import { composeMessage, type Message } from "./planner";
import type { Channel } from "./steps";

/**
 * The send log (Notifications N.1, C139): reading it, pruning it and writing to it. Takes the database
 * as a handle, so the run passes the real one and the tests an in-memory one; it never chooses a
 * database by itself.
 */

export type LogRow = { dedupeKey: string; channel: Channel; status: "dry_run" | "pending" | "sent" | "failed"; createdAt: Date };

/**
 * Whether a logged row counts as "already done" for the channel's current mode. A real row (pending,
 * sent or failed) always counts: a real notice never repeats, even after a failure (it may have left).
 * A dry-run row only counts while the channel is still dry, so it never blocks the first real send.
 */
export function rowCounts(row: Pick<LogRow, "channel" | "status">, modes: ChannelModes): boolean {
  return row.status !== "dry_run" || modes[row.channel] === "dry";
}

/** The dedupe keys already used for one recipient, given each channel's mode. */
export function usedKeysFrom(rows: readonly LogRow[], modes: ChannelModes): Set<string> {
  return new Set(rows.filter((r) => rowCounts(r, modes)).map((r) => r.dedupeKey));
}

/** The channels that already carried a message to this recipient on `today` (in `timeZone`). */
export function channelsUsedOn(rows: readonly LogRow[], modes: ChannelModes, today: string, timeZone: string): Set<Channel> {
  return new Set(rows.filter((r) => rowCounts(r, modes) && todayIn(timeZone, r.createdAt) === today).map((r) => r.channel));
}

/** One recipient's log (small: a few rows a week, pruned after a year). */
export async function readLog(db: Db, recipient: string): Promise<LogRow[]> {
  return db
    .select({ dedupeKey: notifications.dedupeKey, channel: notifications.channel, status: notifications.status, createdAt: notifications.createdAt })
    .from(notifications)
    .where(eq(notifications.recipient, recipient));
}

/** Deletes rows sent (or, for dry runs and failures, written) more than a year before `now`. Returns how many. */
export async function pruneLog(db: Db, now: Date): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const gone = await db
    .delete(notifications)
    .where(sql`coalesce(${notifications.sentAt}, ${notifications.createdAt}) < ${cutoff.toISOString()}`)
    .returning({ id: notifications.id });
  return gone.length;
}

function rowsOf(message: Message, status: "dry_run" | "pending") {
  return message.notices.map((n) => ({
    recipient: message.recipient,
    dedupeKey: n.dedupeKey,
    channel: n.channel,
    kind: n.event,
    title: n.title,
    body: n.body,
    href: n.href,
    dueDate: n.dueDate,
    status,
  }));
}

export type WriteResult = { written: number; sent: number; failed: number; message: Message | null };

/**
 * Logs one message as a dry run: a `dry_run` row per notice, nothing sent. A key already logged as a
 * dry run is skipped by its unique index.
 */
export async function recordDryRun(db: Db, message: Message): Promise<WriteResult> {
  const inserted = await db.insert(notifications).values(rowsOf(message, "dry_run")).onConflictDoNothing().returning({ id: notifications.id });
  return { written: inserted.length, sent: 0, failed: 0, message };
}

/**
 * Sends one message for real: writes a `pending` row per notice FIRST (the unique index refuses a key
 * that was ever really logged, so a second run or a crash cannot send it again), sends only the notices
 * whose row was written, then stamps them `sent` or `failed` with the error.
 */
export async function sendLive(db: Db, message: Message, sender: Pick<ChannelSender, "send">, now: () => Date = () => new Date()): Promise<WriteResult> {
  const inserted = await db
    .insert(notifications)
    .values(rowsOf(message, "pending"))
    .onConflictDoNothing()
    .returning({ id: notifications.id, dedupeKey: notifications.dedupeKey });
  if (inserted.length === 0) return { written: 0, sent: 0, failed: 0, message: null };

  const claimed = new Set(inserted.map((r) => r.dedupeKey));
  const toSend = composeMessage(
    message.recipient,
    message.channel,
    message.notices.filter((n) => claimed.has(n.dedupeKey)),
  );
  const ids = inserted.map((r) => r.id);
  try {
    await sender.send(toSend);
    await db
      .update(notifications)
      .set({ status: "sent", sentAt: now() })
      .where(and(inArray(notifications.id, ids), eq(notifications.status, "pending")));
    return { written: ids.length, sent: ids.length, failed: 0, message: toSend };
  } catch (err) {
    const error = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    await db
      .update(notifications)
      .set({ status: "failed", error })
      .where(and(inArray(notifications.id, ids), eq(notifications.status, "pending")));
    return { written: ids.length, sent: 0, failed: ids.length, message: toSend };
  }
}

/** Writes one message the way its channel's mode says. */
export function writeMessage(db: Db, message: Message, mode: ChannelMode, sender: Pick<ChannelSender, "send">): Promise<WriteResult> {
  return mode === "live" ? sendLive(db, message, sender) : recordDryRun(db, message);
}

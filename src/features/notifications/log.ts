import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/read";
import { notifications } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { NotSentError, type ChannelMode, type ChannelModes, type ChannelSender, type SendContext } from "./channels";
import { composeMessage, type Message } from "./planner";
import type { Channel } from "./steps";

/**
 * The send log (Notifications N.1, C139): reading it, pruning it and writing to it. Takes the database
 * as a handle, so the run passes the real one and the tests an in-memory one; it never chooses a
 * database by itself.
 */

export type LogStatus = "dry_run" | "pending" | "sent" | "failed";
export type LogRow = { dedupeKey: string; channel: Channel; status: LogStatus; createdAt: Date };

/**
 * Whether a logged row counts as "already done" for the channel's current mode.
 *  - `pending` and `sent` always count: what went out (or may have) never goes again.
 *  - `failed` never counts: the provider refused it and nothing went out, so it may be retried while timely.
 *  - `dry_run` counts only while the channel is still dry, so it never blocks the first real send.
 */
export function rowCounts(row: Pick<LogRow, "channel" | "status">, modes: ChannelModes): boolean {
  if (row.status === "failed") return false;
  return row.status !== "dry_run" || modes[row.channel] === "dry";
}

/** A `pending` row older than this never finished sending: Settings shows it as "Unknown" (never retried). */
export const PENDING_UNKNOWN_AFTER_MS = 10 * 60 * 1000;

/** A row's state as Settings shows it: a pending row that is too old becomes "unknown". */
export function shownStatus(row: Pick<LogRow, "status" | "createdAt">, now: Date): LogStatus | "unknown" {
  return row.status === "pending" && now.getTime() - row.createdAt.getTime() > PENDING_UNKNOWN_AFTER_MS ? "unknown" : row.status;
}

/**
 * A notice the provider refused this many times is not planned again (review of #198): a message that
 * is refused every time (a bad address, a payload the service rejects) must not be retried every morning.
 */
export const MAX_FAILED_TRIES = 3;

/**
 * The dedupe keys already used for one recipient, given each channel's mode: every key that counts as
 * done (see `rowCounts`), and every key with MAX_FAILED_TRIES `failed` rows.
 */
export function usedKeysFrom(rows: readonly LogRow[], modes: ChannelModes): Set<string> {
  const used = new Set(rows.filter((r) => rowCounts(r, modes)).map((r) => r.dedupeKey));
  const failures = new Map<string, number>();
  for (const r of rows) if (r.status === "failed") failures.set(r.dedupeKey, (failures.get(r.dedupeKey) ?? 0) + 1);
  for (const [key, count] of failures) if (count >= MAX_FAILED_TRIES) used.add(key);
  return used;
}

/** The channels that already carried a message to this recipient on `today` (in `timeZone`). */
export function channelsUsedOn(rows: readonly LogRow[], modes: ChannelModes, today: string, timeZone: string): Set<Channel> {
  return new Set(rows.filter((r) => rowCounts(r, modes) && todayIn(timeZone, r.createdAt) === today).map((r) => r.channel));
}

/** The kind of the rows a test push writes (N.3): logged and shown, but never part of the planning. */
export const TEST_KIND = "push-test";

/**
 * One recipient's log (small: a few rows a week, pruned after a year), as the planning sees it: test
 * pushes are left out, so a test never uses up the day's push or blocks a notice.
 */
export async function readLog(db: Db, recipient: string): Promise<LogRow[]> {
  return db
    .select({ dedupeKey: notifications.dedupeKey, channel: notifications.channel, status: notifications.status, createdAt: notifications.createdAt })
    .from(notifications)
    .where(and(eq(notifications.recipient, recipient), ne(notifications.kind, TEST_KIND)));
}

/**
 * Housekeeping: deletes rows sent (or, for dry runs, failures and unknowns, written) more than a year
 * before `now`. Returns how many. A pruned key cannot come back: plan-ahead and act-now notices are
 * before their due date and the overdue one within a week of it.
 */
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

export type WriteResult = {
  written: number;
  sent: number;
  /** Refused by the provider: nothing went out, may be retried. */
  failed: number;
  /** The sender broke without saying whether it went out: left pending, never retried. */
  unknown: number;
  message: Message | null;
};

const shortError = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);

/**
 * Logs one message as a dry run: a `dry_run` row per notice, nothing sent. A key already logged as a
 * dry run is skipped by its unique index.
 */
export async function recordDryRun(db: Db, message: Message): Promise<WriteResult> {
  const inserted = await db.insert(notifications).values(rowsOf(message, "dry_run")).onConflictDoNothing().returning({ id: notifications.id });
  return { written: inserted.length, sent: 0, failed: 0, unknown: 0, message: inserted.length > 0 ? message : null };
}

/**
 * Sends one message for real: writes a `pending` row per notice FIRST (the unique index refuses a key
 * that is pending or sent, so a second run or a crash cannot send it again), sends only the notices
 * whose row was written, then stamps them `sent`. If the sender says nothing went out (`NotSentError`)
 * they become `failed` and may be retried; any other error leaves them `pending` with the error noted.
 */
export async function sendLive(
  db: Db,
  message: Message,
  sender: Pick<ChannelSender, "send">,
  now: () => Date = () => new Date(),
  context?: SendContext,
): Promise<WriteResult> {
  const inserted = await db
    .insert(notifications)
    .values(rowsOf(message, "pending"))
    .onConflictDoNothing()
    .returning({ id: notifications.id, dedupeKey: notifications.dedupeKey });
  if (inserted.length === 0) return { written: 0, sent: 0, failed: 0, unknown: 0, message: null };

  const claimed = new Set(inserted.map((r) => r.dedupeKey));
  const toSend = composeMessage(
    message.recipient,
    message.channel,
    message.notices.filter((n) => claimed.has(n.dedupeKey)),
    message.listHref,
  );
  const ids = inserted.map((r) => r.id);
  const mine = and(inArray(notifications.id, ids), eq(notifications.status, "pending"));
  try {
    await sender.send(toSend, context);
  } catch (err) {
    if (err instanceof NotSentError) {
      await db.update(notifications).set({ status: "failed", error: shortError(err) }).where(mine);
      return { written: ids.length, sent: 0, failed: ids.length, unknown: 0, message: toSend };
    }
    await db.update(notifications).set({ error: `Unknown outcome: ${shortError(err)}` }).where(mine);
    return { written: ids.length, sent: 0, failed: 0, unknown: ids.length, message: toSend };
  }
  await db.update(notifications).set({ status: "sent", sentAt: now() }).where(mine);
  return { written: ids.length, sent: ids.length, failed: 0, unknown: 0, message: toSend };
}

/** Writes one message the way its channel's mode says. `context` (the run's day) goes to the sender. */
export function writeMessage(db: Db, message: Message, mode: ChannelMode, sender: Pick<ChannelSender, "send">, context?: SendContext): Promise<WriteResult> {
  return mode === "live" ? sendLive(db, message, sender, undefined, context) : recordDryRun(db, message);
}

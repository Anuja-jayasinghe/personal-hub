import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./_columns";

/**
 * The devices an owner turned iPhone pushes on for (Notifications N.3, DECISIONS C140): one row per
 * browser push subscription. Row-level security on (C27).
 *
 * The endpoint is the push service's address for that device and the keys encrypt the message for it;
 * all three are secrets of a sort (anyone holding them can push to the device), so they are never
 * logged, never sent back to the browser and never shown. The endpoint must be one of the real push
 * services (checked when it is saved and again before every send, src/features/notifications/push).
 * A subscription the push service says is gone (404 or 410) is deleted.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Lower-cased email of the owner it belongs to (the send log's recipient). */
    recipient: text("recipient").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    /** The device's public key (base64url, from `PushSubscription.toJSON().keys`). */
    p256dh: text("p256dh").notNull(),
    /** The device's auth secret (base64url). */
    auth: text("auth").notNull(),
    /** "iPhone", "iPad", "Mac" …: worked out from the browser, never typed. */
    deviceLabel: text("device_label").notNull(),
    createdAt: createdAt(),
    /** The last time the push service accepted a message for it. */
    lastOkAt: timestamp("last_ok_at", { withTimezone: true }),
  },
  (t) => [
    check("push_subscriptions_recipient_check", sql`${t.recipient} = lower(${t.recipient}) and length(${t.recipient}) between 3 and 320`),
    check("push_subscriptions_endpoint_check", sql`${t.endpoint} like 'https://%' and length(${t.endpoint}) <= 1024`),
    check("push_subscriptions_p256dh_check", sql`${t.p256dh} ~ '^[A-Za-z0-9_-]{80,100}$'`),
    check("push_subscriptions_auth_check", sql`${t.auth} ~ '^[A-Za-z0-9_-]{16,32}$'`),
    check("push_subscriptions_device_label_check", sql`length(${t.deviceLabel}) between 1 and 40`),
    index("push_subscriptions_recipient_idx").on(t.recipient),
  ],
).enableRLS();

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

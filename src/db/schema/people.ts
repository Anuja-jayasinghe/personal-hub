import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./_columns";

/**
 * People the hub is shared with (S.8, DECISIONS C114; Phase 5, P40). The owners are the addresses in
 * ALLOWED_EMAILS and are not stored here. A person is added by the owner (active) or signs in by
 * themselves (pending, waiting for approval); blocked keeps them out. Row-level security on (C27).
 *
 * Invitations (issue #236, DECISIONS C154): the owner can invite an address by email. The hub creates the
 * person at once as an empty placeholder, `invited`, with the grants the owner chose. An `invited` or
 * `expired` row has NO power: nothing but the sign-in check (src/lib/auth.ts) ever turns it into
 * `active`, and only for the Clerk-verified address, before `invite_expires_at`.
 */
export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Lower-cased; matched against the verified email of the Clerk account that signs in. */
    email: text("email").notNull().unique(),
    name: text("name"),
    status: text("status").$type<"pending" | "active" | "blocked" | "invited" | "expired">().notNull().default("pending"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /**
     * The owner's switch for this person's notifications (N.5, C144): off, the daily run skips them.
     * It never stops them turning pushes on for their device; they simply hear nothing.
     */
    notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
    /** The owner who sent the invitation (lower-cased email). Kept for the record after they join. */
    invitedBy: text("invited_by"),
    /** The inviter's first name, shown in the email and on the sign-up page. A name, never an address. */
    inviterName: text("inviter_name"),
    /**
     * Random and unguessable (22 characters, 128 bits), carried by the sign-up link. It is NOT a
     * credential: it only lets the sign-up page say "<name> invited you" and mark the invitation opened.
     * The gate is always the verified email address.
     */
    inviteCode: text("invite_code"),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    /** When an email for this invitation was last sent (or may have been: an unknown outcome counts). */
    inviteSentAt: timestamp("invite_sent_at", { withTimezone: true }),
    /** The first time the sign-up link was opened. Advisory only (a link preview can set it too). */
    inviteOpenedAt: timestamp("invite_opened_at", { withTimezone: true }),
    /** How many sends (first one and resends) were tried for this person; capped. */
    inviteSendCount: integer("invite_send_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("people_status_check", sql`${t.status} in ('pending', 'active', 'blocked', 'invited', 'expired')`),
    check("people_email_check", sql`${t.email} = lower(${t.email})`),
    uniqueIndex("people_invite_code_idx").on(t.inviteCode).where(sql`${t.inviteCode} is not null`),
    index("people_status_idx").on(t.status),
  ],
).enableRLS();

/**
 * What a person may do in each section (S.8, C114). No row = Hidden. Levels grow: see < add < edit.
 * Sections are the keys in src/features/people/access.ts.
 */
export const accessGrants = pgTable(
  "access_grants",
  {
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    area: text("area").notNull(),
    level: text("level").$type<"see" | "add" | "edit">().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.personId, t.area] }),
    index("access_grants_person_idx").on(t.personId),
    check("access_grants_level_check", sql`${t.level} in ('see', 'add', 'edit')`),
  ],
).enableRLS();

export type Person = typeof people.$inferSelect;
export type AccessGrant = typeof accessGrants.$inferSelect;

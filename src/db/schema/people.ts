import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./_columns";

/**
 * People the hub is shared with (S.8, DECISIONS C114; Phase 5, P40). The owners are the addresses in
 * ALLOWED_EMAILS and are not stored here. A person is added by the owner (active) or signs in by
 * themselves (pending, waiting for approval); blocked keeps them out. Row-level security on (C27).
 */
export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Lower-cased; matched against the verified email of the Clerk account that signs in. */
    email: text("email").notNull().unique(),
    name: text("name"),
    status: text("status").$type<"pending" | "active" | "blocked">().notNull().default("pending"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /**
     * The owner's switch for this person's notifications (N.5, C144): off, the daily run skips them.
     * It never stops them turning pushes on for their device; they simply hear nothing.
     */
    notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("people_status_check", sql`${t.status} in ('pending', 'active', 'blocked')`), check("people_email_check", sql`${t.email} = lower(${t.email})`)],
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

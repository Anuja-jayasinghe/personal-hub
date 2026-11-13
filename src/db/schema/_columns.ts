import { timestamp } from "drizzle-orm/pg-core";

/** Shared timestamp columns (timestamptz, set by the database) used by every table. */
export const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

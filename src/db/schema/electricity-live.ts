import { date, index, pgTable, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./_columns";
import { electricityMeters } from "./electricity";

/**
 * Which meter carries the house (issue #69, DECISIONS C102). The house runs on one meter at a time and
 * is switched by hand when that meter nears its slab; each switch is one row, so the history stays
 * (for the pace maths later, and "who switched" once there are more people, P40). The live meter is
 * the newest switch to a meter that is not archived (src/features/electricity/live.ts).
 * Row-level security on, no policies (C27).
 */
export const electricityLiveSwitches = pgTable(
  "electricity_live_switches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meterId: uuid("meter_id")
      .notNull()
      .references(() => electricityMeters.id, { onDelete: "cascade" }),
    /** Calendar day the house was switched to this meter, "YYYY-MM-DD". */
    switchedOn: date("switched_on", { mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("electricity_live_switches_date_idx").on(t.switchedOn)],
).enableRLS();

export type ElectricityLiveSwitch = typeof electricityLiveSwitches.$inferSelect;

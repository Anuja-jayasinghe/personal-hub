import "server-only";
import { inArray } from "drizzle-orm";
import type { Db } from "@/db/read";
import { vehicleRenewals } from "@/db/schema";

/**
 * Marks records renewed (DECISIONS C46): the one place that does it, used by "Renewed" (renewRenewal) and by the
 * one flow for papers (V.1b). `writer` is the real client or a transaction, so the caller decides what it
 * happens together with.
 */
export async function markRenewed(writer: Pick<Db, "update">, ids: readonly string[], at: Date): Promise<void> {
  if (ids.length === 0) return;
  await writer.update(vehicleRenewals).set({ renewedAt: at }).where(inArray(vehicleRenewals.id, [...ids]));
}

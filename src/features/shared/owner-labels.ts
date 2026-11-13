import "server-only";
import { inArray } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { vehicles } from "@/db/schema";

export type OwnerLabel = { label: string; href: string };

/**
 * Human names for the records that tasks and notes belong to, so lists that mix owners (the Tasks
 * & notes page) can say "Corolla" instead of "vehicle". Keyed by `${ownerType}:${ownerId}`.
 * Add a branch here when another module starts owning tasks or notes.
 */
export async function ownerLabels(
  rows: readonly { ownerType: string | null; ownerId: string | null }[],
): Promise<Map<string, OwnerLabel>> {
  await connection();
  const labels = new Map<string, OwnerLabel>();

  const vehicleIds = [...new Set(rows.flatMap((r) => (r.ownerType === "vehicle" && r.ownerId ? [r.ownerId] : [])))];
  if (vehicleIds.length > 0) {
    const found = await db.select({ id: vehicles.id, nickname: vehicles.nickname }).from(vehicles).where(inArray(vehicles.id, vehicleIds));
    for (const v of found) labels.set(`vehicle:${v.id}`, { label: v.nickname, href: `/vehicles/${v.id}` });
  }
  return labels;
}

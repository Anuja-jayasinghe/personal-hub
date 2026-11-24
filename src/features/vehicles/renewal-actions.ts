"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { appConfig } from "@/config/app.config";
import { db } from "@/db";
import { vehicleRenewals, vehicles } from "@/db/schema";
import { deleteAttachmentsOf } from "@/features/shared/cleanup";
import { toActionState } from "@/features/shared/errors";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { markRenewed } from "./renewal-write";
import { parseRenewal } from "./renewal-validate";
import { requireUser } from "@/lib/auth";

// Server Actions are public HTTP endpoints, so every input is validated here.

const typeLabels = () => appConfig.vehicles.renewalTypes.map((t) => t.label);

function fieldsFrom(fd: FormData, options: { expiryAfter?: string } = {}, forcedType?: string) {
  const raw: Record<string, string | undefined> = {};
  for (const key of ["type", "provider", "startDate", "expiryDate", "amount", "odometerKm"]) {
    const v = fd.get(key);
    raw[key] = typeof v === "string" ? v : undefined;
  }
  if (forcedType) raw.type = forcedType;
  const result = parseRenewal(raw, typeLabels(), options);
  if (!result.ok) throw new ValidationError(result.error);
  return result.value;
}

/** A vehicle whose emission certificates print an inaccurate odometer keeps none (issue #184). */
function withoutIgnoredOdometer<T extends { odometerKm: number | null }>(fields: T, ignore: boolean): T {
  return ignore ? { ...fields, odometerKm: null } : fields;
}

async function ignoresOdometer(vehicleId: string): Promise<boolean> {
  const [v] = await db.select({ ignore: vehicles.ignoreEmissionOdometer }).from(vehicles).where(eq(vehicles.id, vehicleId));
  return v?.ignore ?? false;
}

export async function updateRenewal(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "vehicles", level: "edit" });
    const id = idFrom(fd);
    const [row] = await db.select({ vehicleId: vehicleRenewals.vehicleId }).from(vehicleRenewals).where(eq(vehicleRenewals.id, id));
    if (!row) throw new ValidationError("That renewal could not be found.");
    await db.update(vehicleRenewals).set(withoutIgnoredOdometer(fieldsFrom(fd), await ignoresOdometer(row.vehicleId))).where(eq(vehicleRenewals.id, id));
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

/**
 * "Renewed" (DECISIONS C46): marks the old record renewed and adds the new current one in a single
 * transaction, so there is never a moment with both or neither. History and documents stay with
 * the old record. The type is taken from the old record, never from the form.
 */
export async function renewRenewal(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "vehicles", level: "edit" });
    const oldId = idFrom(fd);
    await db.transaction(async (tx) => {
      const [old] = await tx.select().from(vehicleRenewals).where(eq(vehicleRenewals.id, oldId));
      if (!old) throw new ValidationError("That renewal could not be found.");
      if (old.renewedAt) throw new ValidationError("This renewal has already been renewed.");
      const next = withoutIgnoredOdometer(fieldsFrom(fd, { expiryAfter: old.expiryDate }, old.type), await ignoresOdometer(old.vehicleId));
      await markRenewed(tx, [oldId], new Date());
      await tx.insert(vehicleRenewals).values({ vehicleId: old.vehicleId, ...next });
    });
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function deleteRenewal(fd: FormData): Promise<void> {
  await requireUser({ area: "vehicles", level: "edit" });
  const id = idFrom(fd);
  await deleteAttachmentsOf("vehicle_renewal", id);
  await db.delete(vehicleRenewals).where(eq(vehicleRenewals.id, id));
  refresh();
}

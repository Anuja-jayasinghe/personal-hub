"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { appConfig } from "@/config/app.config";
import { attachments, vehicleOdometerReadings, vehicleRenewals, vehicles } from "@/db/schema";
import { db } from "@/db";
import { deleteAttachmentsOf, deleteSharedDataOf } from "@/features/shared/cleanup";
import { toActionState } from "@/features/shared/errors";
import { removeAttachment, storeAttachment } from "@/features/shared/files";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { todayInAppTz } from "@/lib/format";
import { plateKey, vehiclePath } from "./plate";
import { parseVehicle } from "./validate";
import { requireUser } from "@/lib/auth";

// Server Actions are public HTTP endpoints, so every input is validated here (see shared/actions.ts).

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

function fieldsFrom(fd: FormData) {
  const raw: Record<string, string | undefined> = {};
  for (const key of ["nickname", "registrationNumber", "make", "model", "year", "fuelType", "vehicleType", "odometerKm"]) {
    const v = fd.get(key);
    raw[key] = typeof v === "string" ? v : undefined;
  }
  const result = parseVehicle(
    raw,
    appConfig.vehicles.fuelTypes,
    appConfig.vehicles.types.map((t) => t.key),
  );
  if (!result.ok) throw new ValidationError(result.error);
  return result.value;
}

/** Each plate belongs to one vehicle, since the plate is the vehicle's address (S.6). */
async function refuseDuplicatePlate(registration: string | null, exceptId?: string) {
  if (!registration) return;
  const key = plateKey(registration);
  if (!key) return;
  const sameKey = sql`upper(regexp_replace(coalesce(${vehicles.registrationNumber}, ''), '[^a-zA-Z0-9]', '', 'g')) = ${key}`;
  const [clash] = await db
    .select({ nickname: vehicles.nickname })
    .from(vehicles)
    .where(exceptId ? and(sameKey, ne(vehicles.id, exceptId)) : sameKey)
    .limit(1);
  if (clash) throw new ValidationError(`${clash.nickname} already has that plate number.`);
}

/** The vehicle's own columns, and the odometer typed on the form (which is a dated reading, not a column). */
function vehicleAndOdometer(fd: FormData) {
  const { odometerKm, ...fields } = fieldsFrom(fd);
  return { fields, odometerKm };
}

export async function createVehicle(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let path: string;
  try {
    await requireUser({ area: "vehicles", level: "add" });
    // The odometer typed on the form becomes the first dated reading (today); the old undated
    // column is no longer written.
    const { fields, odometerKm } = vehicleAndOdometer(fd);
    await refuseDuplicatePlate(fields.registrationNumber ?? null);
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(vehicles).values(fields).returning({ id: vehicles.id });
      if (odometerKm !== null) await tx.insert(vehicleOdometerReadings).values({ vehicleId: row.id, readingDate: todayInAppTz(), km: odometerKm });
      return row.id;
    });
    path = vehiclePath({ id, registrationNumber: fields.registrationNumber ?? null });
  } catch (err) {
    return toActionState(err);
  }
  redirect(path); // outside the try: redirect works by throwing
}

export async function updateVehicle(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let path: string;
  try {
    await requireUser({ area: "vehicles", level: "edit" });
    const id = idFrom(fd);
    // Mileage is edited as dated readings on the vehicle's Overview, not here.
    const { fields } = vehicleAndOdometer(fd);
    await refuseDuplicatePlate(fields.registrationNumber ?? null, id);
    await db.update(vehicles).set(fields).where(eq(vehicles.id, id));
    path = vehiclePath({ id, registrationNumber: fields.registrationNumber ?? null });
  } catch (err) {
    return toActionState(err);
  }
  redirect(path);
}

export async function archiveVehicle(fd: FormData): Promise<void> {
  await requireUser({ area: "vehicles", level: "edit" });
  await db.update(vehicles).set({ archivedAt: new Date() }).where(eq(vehicles.id, idFrom(fd)));
  redirect("/vehicles");
}

export async function unarchiveVehicle(fd: FormData): Promise<void> {
  await requireUser({ area: "vehicles", level: "edit" });
  const id = idFrom(fd);
  const [row] = await db.update(vehicles).set({ archivedAt: null }).where(eq(vehicles.id, id)).returning({ registrationNumber: vehicles.registrationNumber });
  redirect(vehiclePath({ id, registrationNumber: row?.registrationNumber ?? null }));
}

/** Permanent. Removes the vehicle and everything it owns: tasks, notes, files and the cover photo. */
export async function deleteVehicle(fd: FormData): Promise<void> {
  await requireUser({ area: "vehicles", level: "edit" });
  const id = idFrom(fd);
  // Renewal documents are attachments owned by each renewal, which the database cannot cascade to.
  const renewals = await db.select({ id: vehicleRenewals.id }).from(vehicleRenewals).where(eq(vehicleRenewals.vehicleId, id));
  for (const r of renewals) await deleteAttachmentsOf("vehicle_renewal", r.id);
  await deleteSharedDataOf("vehicle", id);
  await db.delete(vehicles).where(eq(vehicles.id, id)); // services and renewals cascade
  redirect("/vehicles");
}

/** Sets or replaces the cover photo (DECISIONS C47). The old photo is deleted once the new one is saved. */
export async function setVehicleCover(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "vehicles", level: "edit" });
    const id = idFrom(fd, "vehicleId");
    const file = fd.get("file");
    if (!(file instanceof File)) throw new ValidationError("Choose a photo to upload.");

    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    if (!vehicle) throw new ValidationError("That vehicle could not be found.");

    const photo = await storeAttachment(
      { ownerType: "vehicle", ownerId: id },
      file,
      COVER_TYPES,
      "The cover photo must be a JPEG, PNG or WebP image.",
    );
    const oldCoverId = vehicle.coverAttachmentId;
    try {
      await db.update(vehicles).set({ coverAttachmentId: photo.id }).where(eq(vehicles.id, id));
    } catch (err) {
      await removeAttachment(photo); // don't leave an unused photo behind
      throw err;
    }
    if (oldCoverId) {
      const [old] = await db.select().from(attachments).where(eq(attachments.id, oldCoverId));
      if (old) await removeAttachment(old);
    }
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function removeVehicleCover(fd: FormData): Promise<void> {
  await requireUser({ area: "vehicles", level: "edit" });
  const id = idFrom(fd);
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  if (!vehicle?.coverAttachmentId) return;
  const [photo] = await db.select().from(attachments).where(eq(attachments.id, vehicle.coverAttachmentId));
  await db.update(vehicles).set({ coverAttachmentId: null }).where(eq(vehicles.id, id));
  if (photo) await removeAttachment(photo);
  refresh();
}

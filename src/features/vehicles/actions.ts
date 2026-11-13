"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { appConfig } from "@/config/app.config";
import { attachments, vehicleRenewals, vehicles } from "@/db/schema";
import { db } from "@/db";
import { deleteAttachmentsOf, deleteSharedDataOf } from "@/features/shared/cleanup";
import { toActionState } from "@/features/shared/errors";
import { removeAttachment, storeAttachment } from "@/features/shared/files";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { parseVehicle } from "./validate";

// Server Actions are public HTTP endpoints, so every input is validated here (see shared/actions.ts).

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

function fieldsFrom(fd: FormData) {
  const raw: Record<string, string | undefined> = {};
  for (const key of ["nickname", "registrationNumber", "make", "model", "year", "fuelType", "odometerKm"]) {
    const v = fd.get(key);
    raw[key] = typeof v === "string" ? v : undefined;
  }
  const result = parseVehicle(raw, appConfig.vehicles.fuelTypes);
  if (!result.ok) throw new ValidationError(result.error);
  return result.value;
}

export async function createVehicle(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const [row] = await db.insert(vehicles).values(fieldsFrom(fd)).returning({ id: vehicles.id });
    id = row.id;
  } catch (err) {
    return toActionState(err);
  }
  redirect(`/vehicles/${id}`); // outside the try: redirect works by throwing
}

export async function updateVehicle(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = idFrom(fd);
    await db.update(vehicles).set(fieldsFrom(fd)).where(eq(vehicles.id, id));
  } catch (err) {
    return toActionState(err);
  }
  redirect(`/vehicles/${id}`);
}

export async function archiveVehicle(fd: FormData): Promise<void> {
  await db.update(vehicles).set({ archivedAt: new Date() }).where(eq(vehicles.id, idFrom(fd)));
  redirect("/vehicles");
}

export async function unarchiveVehicle(fd: FormData): Promise<void> {
  const id = idFrom(fd);
  await db.update(vehicles).set({ archivedAt: null }).where(eq(vehicles.id, id));
  redirect(`/vehicles/${id}`);
}

/** Permanent. Removes the vehicle and everything it owns: tasks, notes, files and the cover photo. */
export async function deleteVehicle(fd: FormData): Promise<void> {
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
  const id = idFrom(fd);
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  if (!vehicle?.coverAttachmentId) return;
  const [photo] = await db.select().from(attachments).where(eq(attachments.id, vehicle.coverAttachmentId));
  await db.update(vehicles).set({ coverAttachmentId: null }).where(eq(vehicles.id, id));
  if (photo) await removeAttachment(photo);
  refresh();
}

"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { attachments, vehicles } from "@/db/schema";
import { toActionState } from "@/features/shared/errors";
import { storeAttachment } from "@/features/shared/files";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { requireUser } from "@/lib/auth";
import { parseDocTitle } from "./documents";

// Server Actions are public HTTP endpoints, so every input is validated here.

function titleFrom(fd: FormData): string {
  const raw = fd.get("title");
  const result = parseDocTitle(typeof raw === "string" ? raw : undefined);
  if (!result.ok) throw new ValidationError(result.error);
  return result.value;
}

/** Adds a titled document (image or PDF) to a vehicle. The title is required. */
export async function uploadVehicleDocument(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "vehicle_documents", level: "add" });
    const vehicleId = idFrom(fd, "vehicleId");
    const title = titleFrom(fd);
    const file = fd.get("file");
    if (!(file instanceof File)) throw new ValidationError("Choose a file to upload.");
    const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId));
    if (!vehicle) throw new ValidationError("That vehicle could not be found.");
    await storeAttachment(
      { ownerType: "vehicle", ownerId: vehicleId },
      file,
      undefined,
      undefined,
      title,
    );
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

/** Changes the title of a vehicle's document. */
export async function renameVehicleDocument(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "vehicle_documents", level: "edit" });
    const id = idFrom(fd);
    const title = titleFrom(fd);
    const updated = await db
      .update(attachments)
      .set({ title })
      .where(and(eq(attachments.id, id), eq(attachments.ownerType, "vehicle")))
      .returning({ id: attachments.id });
    if (updated.length === 0) throw new ValidationError("That document could not be found.");
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

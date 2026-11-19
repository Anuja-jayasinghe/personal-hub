"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { areaOfOwner } from "@/features/people/access";
import { requireUser } from "@/lib/auth";
import { isOwnerType, type OwnerRef } from "@/lib/owners";
import { COVER_TYPE_MESSAGE, COVER_TYPES } from "@/lib/storage";
import { UPLOAD_PURPOSES, type UploadPurpose } from "@/lib/upload-rules";
import { signUpload } from "./files";
import { toActionState } from "./errors";
import { UUID_RE, ValidationError } from "./validation";

export type PrepareUploadInput = { purpose: UploadPurpose; ownerType: string; ownerId: string; fileName: string; mimeType: string; size: number };

export type PrepareUploadResult = { ok: true; path: string; signedUrl: string } | { ok: false; error: string };

/**
 * Step 1 of every upload (hosting prep, C115): checks who is asking and what for, then returns a one-time
 * link to put the file straight into the private bucket. Step 2 is the form's own action, which records
 * the file after checking what arrived. Same access as before: a file on a record needs Add in its section,
 * a vehicle's cover photo needs Edit in Vehicles, a vehicle document needs Add in Vehicle documents.
 */
export async function prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadResult> {
  try {
    await requireUser("signed-in");
    if (!UPLOAD_PURPOSES.includes(input.purpose)) throw new ValidationError("Unknown upload.");
    if (!isOwnerType(input.ownerType) || !UUID_RE.test(input.ownerId)) throw new ValidationError("That item could not be found.");
    const owner: OwnerRef = { ownerType: input.ownerType, ownerId: input.ownerId };
    const file = { fileName: String(input.fileName ?? "file").slice(0, 255), mimeType: String(input.mimeType ?? ""), size: Number(input.size) };

    if (input.purpose === "attachment") {
      await requireUser({ area: areaOfOwner(owner.ownerType), level: "add" });
      return { ok: true, ...(await signUpload(owner, file)) };
    }
    if (owner.ownerType !== "vehicle") throw new ValidationError("That item could not be found.");
    const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, owner.ownerId));
    if (!vehicle) throw new ValidationError("That vehicle could not be found.");
    if (input.purpose === "cover") {
      await requireUser({ area: "vehicles", level: "edit" });
      return { ok: true, ...(await signUpload(owner, file, COVER_TYPES, COVER_TYPE_MESSAGE)) };
    }
    await requireUser({ area: "vehicle_documents", level: "add" });
    return { ok: true, ...(await signUpload(owner, file)) };
  } catch (err) {
    const state = toActionState(err);
    return { ok: false, error: state.error ?? "Could not prepare the upload." };
  }
}

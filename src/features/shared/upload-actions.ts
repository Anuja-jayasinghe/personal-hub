"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { needOfFile } from "@/features/people/access";
import { chequeFileName } from "@/features/cheques/file-name";
import { renewalFileName, serviceFileName } from "@/features/vehicles/doc-naming";
import { requireUser } from "@/lib/auth";
import { isOwnerType, type OwnerRef } from "@/lib/owners";
import { COVER_TYPE_MESSAGE, COVER_TYPES } from "@/lib/storage";
import { UPLOAD_PURPOSES, type UploadPurpose } from "@/lib/upload-rules";
import { signUpload } from "./files";
import { toActionState } from "./errors";
import { UUID_RE, ValidationError } from "./validation";

export type PrepareUploadInput = {
  purpose: UploadPurpose;
  ownerType: string;
  ownerId: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type PrepareUploadResult = { ok: true; path: string; signedUrl: string } | { ok: false; error: string };

/**
 * Step 1 of every upload (hosting prep, C115): checks who is asking and what for, then returns a one-time
 * link to put the file straight into the private bucket. Step 2 is the form's own action, which records
 * the file after checking what arrived. Same access as before: a file on a record needs Add in the section the file belongs to (`areaOfFile`),
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
      // A new file is never the cover photo (that is its own purpose below), so on a vehicle or a
      // renewal it is a Vehicle document and needs Add there, the same as the Documents tab.
      await requireUser(needOfFile(owner.ownerType, "add"));
      // A renewal's or a service's file is stored under the name the hub gives it (issue #179, V.1a).
      const named =
        owner.ownerType === "vehicle_renewal"
          ? { ...file, fileName: await renewalFileName(owner.ownerId, file.mimeType) }
          : owner.ownerType === "vehicle_service"
            ? { ...file, fileName: await serviceFileName(owner.ownerId, file.mimeType) }
            : owner.ownerType === "cheque"
              ? { ...file, fileName: await chequeFileName(owner.ownerId, file.mimeType) }
              : file;
      return { ok: true, ...(await signUpload(owner, named)) };
    }
    if (owner.ownerType !== "vehicle") throw new ValidationError("That item could not be found.");
    const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, owner.ownerId));
    if (!vehicle) throw new ValidationError("That vehicle could not be found.");
    if (input.purpose === "cover") {
      await requireUser({ area: "vehicles", level: "edit" });
      return { ok: true, ...(await signUpload(owner, file, COVER_TYPES, COVER_TYPE_MESSAGE)) };
    }
    throw new ValidationError("Unknown upload.");
  } catch (err) {
    const state = toActionState(err);
    return { ok: false, error: state.error ?? "Could not prepare the upload." };
  }
}

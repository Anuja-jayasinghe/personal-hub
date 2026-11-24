"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { toActionState } from "@/features/shared/errors";
import { recordUpload, removeAttachment, uploadedFrom } from "@/features/shared/files";
import { fileArea } from "@/features/people/file-area";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { requireUser } from "@/lib/auth";
import { extensionFor, replacementName } from "./doc-names";
import { parseDocTitle } from "./documents";

// Server Actions are public HTTP endpoints, so every input is validated here.

function titleFrom(fd: FormData): string {
  const raw = fd.get("title");
  const result = parseDocTitle(typeof raw === "string" ? raw : undefined);
  if (!result.ok) throw new ValidationError(result.error);
  return result.value;
}

/** Changes the title of a vehicle's document. A vehicle's cover photo is part of Vehicles, not a document, so it is refused. */
export async function renameVehicleDocument(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "vehicle_documents", level: "edit" });
    const id = idFrom(fd);
    const title = titleFrom(fd);
    const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
    if (!row || row.ownerType !== "vehicle" || (await fileArea(row)) !== "vehicle_documents") throw new ValidationError("That document could not be found.");
    await db.update(attachments).set({ title }).where(eq(attachments.id, id));
    refresh();
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

/**
 * Replaces the file of a paper (issue #187): a vehicle's own document or a file on one of its renewals. The
 * browser has already put the new file in storage (C115, the same "attachment" upload as the record's own
 * form). The new file keeps the old one's name (with its own extension) and title; the old file goes once
 * the new one is recorded, so a failure never leaves the paper with neither. If the old file then cannot be
 * removed, the replace still succeeded: it says so gently instead of failing, so trying again does not add a
 * third file. Removing a file needs Edit in Vehicle documents, so replacing one does too; a vehicle's cover
 * photo is not a paper and is refused, and so is "replacing" a file with its own stored object.
 */
export async function replaceVehicleFile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "vehicle_documents", level: "edit" });
    const id = idFrom(fd);
    const [old] = await db.select().from(attachments).where(eq(attachments.id, id));
    if (!old || (old.ownerType !== "vehicle" && old.ownerType !== "vehicle_renewal")) throw new ValidationError("That file could not be found.");
    if ((await fileArea(old)) !== "vehicle_documents") throw new ValidationError("That file could not be found.");
    const uploaded = uploadedFrom(fd);
    if (uploaded.path === old.storagePath) throw new ValidationError("Choose the new file to upload.");
    const siblings = await db
      .select({ id: attachments.id, fileName: attachments.fileName })
      .from(attachments)
      .where(and(eq(attachments.ownerType, old.ownerType), eq(attachments.ownerId, old.ownerId)));
    const taken = siblings.filter((s) => s.id !== old.id).map((s) => s.fileName);
    await recordUpload({ ownerType: old.ownerType, ownerId: old.ownerId }, uploaded, undefined, undefined, old.title, async (mimeType) =>
      replacementName(old.fileName, extensionFor(mimeType), taken),
    );
    refresh();
    try {
      await removeAttachment(old);
    } catch (err) {
      console.error(err);
      return { ok: true, notice: "The new file is saved, but the old one could not be removed. Delete it from the ⋯ menu." };
    }
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

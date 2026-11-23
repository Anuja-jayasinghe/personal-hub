"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { attachments, vehicles } from "@/db/schema";
import { toActionState } from "@/features/shared/errors";
import { recordUpload, uploadedFrom } from "@/features/shared/files";
import type { ActionState } from "@/features/shared/types";
import { idFrom, ValidationError } from "@/features/shared/validation";
import { requireUser } from "@/lib/auth";
import { parseDocUpload, type DocUpload } from "./doc-names";
import { vehicleDocFileName } from "./doc-naming";
import { DOC_TITLE_MAX, parseDocTitle } from "./documents";

// Server Actions are public HTTP endpoints, so every input is validated here.

function titleFrom(fd: FormData): string {
  const raw = fd.get("title");
  const result = parseDocTitle(typeof raw === "string" ? raw : undefined);
  if (!result.ok) throw new ValidationError(result.error);
  return result.value;
}

function docFrom(fd: FormData): DocUpload {
  const text = (name: string) => {
    const v = fd.get(name);
    return typeof v === "string" ? v : undefined;
  };
  const result = parseDocUpload({ kind: text("kind"), date: text("date"), title: text("title") }, DOC_TITLE_MAX);
  if (!result.ok) throw new ValidationError(result.error);
  return result.value;
}

/**
 * Adds a document (image or PDF) to a vehicle. The form says what it is and its date, and the hub names
 * the file from those and the plate (issue #179); the title is optional.
 */
export async function uploadVehicleDocument(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireUser({ area: "vehicle_documents", level: "add" });
    const vehicleId = idFrom(fd, "vehicleId");
    const doc = docFrom(fd);
    const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId));
    if (!vehicle) throw new ValidationError("That vehicle could not be found.");
    // The browser has already put the file in storage (C115); this records it after checking it.
    await recordUpload({ ownerType: "vehicle", ownerId: vehicleId }, uploadedFrom(fd), undefined, undefined, doc.title, (mimeType) => vehicleDocFileName(vehicleId, doc, mimeType));
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

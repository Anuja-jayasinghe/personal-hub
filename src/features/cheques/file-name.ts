import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments, cheques } from "@/db/schema";
import { ValidationError } from "@/features/shared/validation";
import { extensionFor } from "@/features/vehicles/doc-names";
import { chequePhotoName, MAX_CHEQUE_PHOTOS } from "./photos";

/**
 * Names a cheque's photo from the hub's own data (issue #178), never from the uploader's file name:
 * `cheque_<cheque date>_<n>.<ext>`. Also stops a third file: a cheque keeps a front and a back. Reads
 * the real database after the caller has checked the person (allowed in read-guard.test.ts, like the
 * vehicle documents' naming).
 */
export async function chequeFileName(chequeId: string, mimeType: string): Promise<string> {
  const [row] = await db.select({ date: cheques.chequeDate }).from(cheques).where(eq(cheques.id, chequeId));
  if (!row) throw new ValidationError("That cheque could not be found.");
  const taken = await db
    .select({ fileName: attachments.fileName })
    .from(attachments)
    .where(and(eq(attachments.ownerType, "cheque"), eq(attachments.ownerId, chequeId)));
  if (taken.length >= MAX_CHEQUE_PHOTOS) throw new ValidationError("A cheque keeps a front and a back photo. Delete one to add another.");
  return chequePhotoName(row.date, taken.map((t) => t.fileName), extensionFor(mimeType));
}

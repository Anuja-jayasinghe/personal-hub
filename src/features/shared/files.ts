import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments, type Attachment } from "@/db/schema";
import type { OwnerRef } from "@/lib/owners";
import { ALLOWED_ATTACHMENT_TYPES, ATTACHMENT_BUCKET, MAX_ATTACHMENT_BYTES, storageClient } from "@/lib/storage";
import { newUploadPath, pathBelongsTo, uploadProblem } from "@/lib/upload-rules";
import { ValidationError } from "./validation";

export type UploadInfo = { fileName: string; mimeType: string; size: number };

/**
 * Step 1 of an upload (C115): checks the file the browser wants to send and returns a one-time upload
 * link for a new path inside the record's folder. The file then goes straight from the browser to the
 * private bucket, because Vercel caps a request at 4.5 MB.
 */
export async function signUpload(
  owner: OwnerRef,
  file: UploadInfo,
  allowedTypes: readonly string[] = ALLOWED_ATTACHMENT_TYPES,
  typeMessage = "Only JPEG, PNG, WebP, HEIC images and PDF files are allowed.",
): Promise<{ path: string; signedUrl: string }> {
  const problem = uploadProblem(file, allowedTypes, MAX_ATTACHMENT_BYTES, typeMessage);
  if (problem) throw new ValidationError(problem);
  const path = newUploadPath(owner, file.fileName, crypto.randomUUID());
  const { data, error } = await storageClient().storage.from(ATTACHMENT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Could not prepare the upload: ${error?.message ?? "no link"}`);
  return { path: data.path, signedUrl: data.signedUrl };
}

/** True when an error is Postgres refusing a duplicate (unique_violation, 23505), also when the driver wraps it. */
export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && typeof e === "object" && depth < 4; e = (e as { cause?: unknown }).cause, depth++) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

/** True when an attachment row already points at this stored object. */
async function isReferenced(path: string): Promise<boolean> {
  const rows = await db.select({ id: attachments.id }).from(attachments).where(eq(attachments.storagePath, path)).limit(1);
  return rows.length > 0;
}

/**
 * Removes a stored object that an upload left behind, but never one an attachment row points at: the browser
 * says which path it uploaded to, so a path that already belongs to a saved file (a cover photo, the file
 * being replaced, a second submit of the same form) must never be deleted on its behalf.
 */
async function removeIfUnreferenced(path: string): Promise<void> {
  if (await isReferenced(path)) return;
  await storageClient().storage.from(ATTACHMENT_BUCKET).remove([path]);
}

/**
 * Step 2 (C115): records a file the browser has just put in storage as an attachment of `owner`. It only
 * trusts what storage reports: the path must be inside the record's folder, must not belong to a file that
 * is already saved, and the stored size and type must pass the same checks; otherwise nothing is recorded
 * and the new object is removed (never an object a saved file uses).
 */
export async function recordUpload(
  owner: OwnerRef,
  uploaded: { path: string; fileName: string },
  allowedTypes: readonly string[] = ALLOWED_ATTACHMENT_TYPES,
  typeMessage = "Only JPEG, PNG, WebP, HEIC images and PDF files are allowed.",
  title: string | null = null,
  /** Names the file from the hub's data (issue #179) instead of the uploader's name; gets the checked type. */
  nameFor?: (mimeType: string) => Promise<string>,
): Promise<Attachment> {
  if (!pathBelongsTo(uploaded.path, owner)) throw new ValidationError("That upload does not belong here. Please try again.");
  if (await isReferenced(uploaded.path)) throw new ValidationError("Already saved.");
  const storage = storageClient().storage.from(ATTACHMENT_BUCKET);
  const { data: info, error } = await storage.info(uploaded.path);
  if (error || !info) throw new ValidationError("The file did not arrive. Please try again.");
  const stored = { size: Number(info.size ?? 0), mimeType: String(info.contentType ?? "") };
  const problem = uploadProblem(stored, allowedTypes, MAX_ATTACHMENT_BYTES, typeMessage);
  if (problem) {
    await removeIfUnreferenced(uploaded.path);
    throw new ValidationError(problem);
  }
  try {
    const fileName = nameFor ? await nameFor(stored.mimeType) : uploaded.fileName;
    const [row] = await db
      .insert(attachments)
      .values({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        bucket: ATTACHMENT_BUCKET,
        storagePath: uploaded.path,
        fileName: fileName.slice(0, 255) || "file",
        title,
        mimeType: stored.mimeType,
        sizeBytes: stored.size,
      })
      .returning();
    return row;
  } catch (dbError) {
    // A duplicate path means another row owns that object (e.g. two submits racing): leave it alone.
    if (isUniqueViolation(dbError)) throw new ValidationError("Already saved.");
    await removeIfUnreferenced(uploaded.path);
    throw dbError;
  }
}

/** The upload fields a form sends after the browser has put the file in storage. */
export function uploadedFrom(fd: FormData): { path: string; fileName: string } {
  const path = fd.get("uploadedPath");
  const fileName = fd.get("fileName");
  if (typeof path !== "string" || !path) throw new ValidationError("Choose a file to upload.");
  return { path, fileName: typeof fileName === "string" ? fileName : "file" };
}

/** Deletes an attachment: the file in storage first, then its row. */
export async function removeAttachment(row: Attachment): Promise<void> {
  const { error } = await storageClient().storage.from(row.bucket).remove([row.storagePath]);
  if (error) throw new Error(`Could not delete file: ${error.message}`);
  await db.delete(attachments).where(eq(attachments.id, row.id));
}

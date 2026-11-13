import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments, type Attachment } from "@/db/schema";
import type { OwnerRef } from "@/lib/owners";
import {
  ALLOWED_ATTACHMENT_TYPES,
  ATTACHMENT_BUCKET,
  MAX_ATTACHMENT_BYTES,
  resolveMimeType,
  storageClient,
} from "@/lib/storage";
import { ValidationError } from "./validation";

function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(-120);
  return cleaned || "file";
}

/**
 * Validates `file`, uploads it to the private bucket and records it as an attachment of `owner`.
 * `allowedTypes` narrows what is accepted (the vehicle cover photo only takes web image types).
 * If recording it fails the uploaded file is removed again, so nothing is left behind.
 */
export async function storeAttachment(
  owner: OwnerRef,
  file: File,
  allowedTypes: readonly string[] = ALLOWED_ATTACHMENT_TYPES,
  typeMessage = "Only JPEG, PNG, WebP, HEIC images and PDF files are allowed.",
): Promise<Attachment> {
  if (file.size === 0) throw new ValidationError("Choose a file to upload.");
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new ValidationError(`File is too large. The limit is ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`);
  }
  const mimeType = resolveMimeType(file);
  if (!allowedTypes.includes(mimeType)) throw new ValidationError(typeMessage);

  const storagePath = `${owner.ownerType}/${owner.ownerId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const storage = storageClient().storage.from(ATTACHMENT_BUCKET);
  const { error: uploadError } = await storage.upload(storagePath, Buffer.from(await file.arrayBuffer()), {
    contentType: mimeType,
  });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  try {
    const [row] = await db
      .insert(attachments)
      .values({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        bucket: ATTACHMENT_BUCKET,
        storagePath,
        fileName: file.name.slice(0, 255),
        mimeType,
        sizeBytes: file.size,
      })
      .returning();
    return row;
  } catch (dbError) {
    await storage.remove([storagePath]);
    throw dbError;
  }
}

/** Deletes an attachment: the file in storage first, then its row. */
export async function removeAttachment(row: Attachment): Promise<void> {
  const { error } = await storageClient().storage.from(row.bucket).remove([row.storagePath]);
  if (error) throw new Error(`Could not delete file: ${error.message}`);
  await db.delete(attachments).where(eq(attachments.id, row.id));
}

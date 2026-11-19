/**
 * Rules for files sent straight from the browser to private storage (hosting prep, C115). Pure.
 * Vercel caps a request at 4.5 MB, so files no longer pass through the server: the server hands out a
 * one-time upload link for a path inside the record's folder, and records the file only after checking
 * what actually arrived there.
 */

export const UPLOAD_PURPOSES = ["attachment", "cover", "document"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(-120);
  return cleaned || "file";
}

/** The folder a record's files live in: "<ownerType>/<ownerId>/". */
export function ownerFolder(owner: { ownerType: string; ownerId: string }): string {
  return `${owner.ownerType}/${owner.ownerId}/`;
}

/** A new, unguessable path for a file of `owner`. */
export function newUploadPath(owner: { ownerType: string; ownerId: string }, fileName: string, id: string): string {
  return `${ownerFolder(owner)}${id}-${safeFileName(fileName)}`;
}

/** True when `path` is a single file directly inside the record's folder (no "..", no sub-folders). */
export function pathBelongsTo(path: string, owner: { ownerType: string; ownerId: string }): boolean {
  const folder = ownerFolder(owner);
  if (!path.startsWith(folder)) return false;
  const rest = path.slice(folder.length);
  return rest.length > 0 && !rest.includes("/") && !rest.includes("..") && /^[0-9a-f-]{36}-[A-Za-z0-9._-]+$/.test(rest);
}

/** Why a file cannot be accepted, or null. */
export function uploadProblem(file: { size: number; mimeType: string }, allowed: readonly string[], maxBytes: number, typeMessage: string): string | null {
  if (!Number.isFinite(file.size) || file.size <= 0) return "Choose a file to upload.";
  if (file.size > maxBytes) return `File is too large. The limit is ${maxBytes / 1024 / 1024} MB.`;
  if (!allowed.includes(file.mimeType)) return typeMessage;
  return null;
}

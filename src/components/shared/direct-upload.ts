"use client";

import { useState, useTransition, type FormEvent } from "react";
import { prepareUpload } from "@/features/shared/upload-actions";
import type { UploadPurpose } from "@/lib/upload-rules";

export type UploadTarget = { purpose: UploadPurpose; ownerType: string; ownerId: string };

/** Browsers sometimes send an empty type for HEIC photos; fall back to the extension (as the server does). */
function typeOf(file: File): string {
  if (file.type) return file.type;
  return /\.heic$/i.test(file.name) ? "image/heic" : "";
}

/**
 * Sends a file straight to the private bucket (hosting prep, C115): asks the server for a one-time upload
 * link (it checks access, type and size), then puts the file there. Nothing secret reaches the browser:
 * the link works once, for one new path.
 */
export async function sendToStorage(file: File, target: UploadTarget): Promise<{ path: string; fileName: string }> {
  const mimeType = typeOf(file);
  const prep = await prepareUpload({ ...target, fileName: file.name, mimeType, size: file.size });
  if (!prep.ok) throw new Error(prep.error);
  let res: Response;
  try {
    res = await fetch(prep.signedUrl, { method: "PUT", body: file, headers: { "content-type": mimeType, "x-upsert": "false" } });
  } catch {
    throw new Error("The upload did not go through. Check your connection and try again.");
  }
  if (!res.ok) throw new Error("The upload did not go through. Please try again.");
  return { path: prep.path, fileName: file.name };
}

/**
 * For a form with a file input named "file": on submit, the file goes to storage first, then the form's
 * own action runs with `uploadedPath` and `fileName` instead of the file (C115).
 */
export function useDirectUpload(dispatch: (fd: FormData) => void, targetOf: (fd: FormData) => UploadTarget) {
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [, startTransition] = useTransition();

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a file to upload.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      const uploaded = await sendToStorage(file, targetOf(fd));
      fd.delete("file");
      fd.set("uploadedPath", uploaded.path);
      fd.set("fileName", uploaded.fileName);
      startTransition(() => dispatch(fd));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The upload did not go through.");
    } finally {
      setSending(false);
    }
  };

  return { onSubmit, error, sending };
}

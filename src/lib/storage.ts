import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Private Supabase Storage bucket for attachments (DECISIONS C33). Created by scripts/storage-setup.mjs. */
export const ATTACHMENT_BUCKET = "attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // keep in sync with scripts/storage-setup.mjs
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

/** The vehicle cover photo only takes web image types. */
export const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const COVER_TYPE_MESSAGE = "The cover photo must be a JPEG, PNG or WebP image.";

const globalForStorage = globalThis as unknown as { __storageClient?: SupabaseClient };

/**
 * Server-only Supabase client using the secret key (DECISIONS C19/C34). Never import this from a
 * client component; the `server-only` import above makes the build fail if someone does.
 */
export function storageClient(): SupabaseClient {
  if (globalForStorage.__storageClient) return globalForStorage.__storageClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY are not set. See .env.example.");
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (process.env.NODE_ENV !== "production") globalForStorage.__storageClient = client;
  return client;
}

/** Browsers sometimes send an empty type for HEIC photos; fall back to the extension. */
export function resolveMimeType(file: File): string {
  if (file.type) return file.type;
  if (/\.heic$/i.test(file.name)) return "image/heic";
  return "";
}

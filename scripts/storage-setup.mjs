// Creates (or updates) the private Supabase Storage bucket for attachments. Safe to re-run.
// Run: pnpm storage:setup   — settings mirror DECISIONS C33 (private bucket, 10 MB, images + PDFs).
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables may already be set in the environment.
}

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("FAIL  SUPABASE_URL / SUPABASE_SECRET_KEY are not set (see .env.example)");
  process.exit(1);
}

export const BUCKET = "attachments";
const options = {
  public: false,
  fileSizeLimit: 10 * 1024 * 1024, // 10 MB
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"],
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) {
  console.error(`FAIL  could not list buckets: ${listError.message}`);
  process.exit(1);
}

const exists = buckets.some((b) => b.name === BUCKET);
const { error } = exists
  ? await supabase.storage.updateBucket(BUCKET, options)
  : await supabase.storage.createBucket(BUCKET, options);

if (error) {
  console.error(`FAIL  ${exists ? "update" : "create"} bucket "${BUCKET}": ${error.message}`);
  process.exit(1);
}
console.log(`PASS  bucket "${BUCKET}" ${exists ? "updated" : "created"} (private, 10 MB, images + PDF)`);

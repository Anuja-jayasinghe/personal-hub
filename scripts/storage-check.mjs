// Sanity check for file storage (run: pnpm storage:check). Cleans up after itself.
//   1. the "attachments" bucket exists and is private
//   2. upload -> signed link works -> download matches
//   3. the PUBLIC link for the same file does NOT work (bucket really is private)
//   4. disallowed file types are rejected
//   5. the file is deleted
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

const BUCKET = "attachments";
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
let failed = false;
const ok = (m) => console.log(`PASS  ${m}`);
const bad = (m) => {
  failed = true;
  console.log(`FAIL  ${m}`);
};

const path = `__storage_check/${Date.now()}.pdf`;
const content = Buffer.from("%PDF-1.4\n% storage check\n");

try {
  const { data: bucket, error: bErr } = await supabase.storage.getBucket(BUCKET);
  if (bErr) throw new Error(`bucket lookup: ${bErr.message}`);
  (bucket.public === false ? ok : bad)(`bucket "${BUCKET}" is ${bucket.public ? "PUBLIC" : "private"}`);

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, content, { contentType: "application/pdf" });
  (upErr ? bad : ok)(upErr ? `upload failed: ${upErr.message}` : "upload a small PDF");

  const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (sErr) bad(`signed link: ${sErr.message}`);
  else {
    const res = await fetch(signed.signedUrl);
    const body = Buffer.from(await res.arrayBuffer());
    (res.ok && body.equals(content) ? ok : bad)(`signed link downloads the same bytes (HTTP ${res.status})`);
  }

  const publicRes = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`);
  (publicRes.ok ? bad : ok)(`public link is refused (HTTP ${publicRes.status})`);

  const { error: typeErr } = await supabase.storage
    .from(BUCKET)
    .upload(`__storage_check/${Date.now()}.exe`, Buffer.from("MZ"), { contentType: "application/x-msdownload" });
  (typeErr ? ok : bad)(typeErr ? "disallowed file type is rejected" : "disallowed file type was ACCEPTED");
} catch (err) {
  bad(`error: ${err.message}`);
} finally {
  const { error: delErr } = await supabase.storage.from(BUCKET).remove([path]);
  (delErr ? bad : ok)(delErr ? `cleanup failed: ${delErr.message}` : "cleanup: test file removed");
}

process.exit(failed ? 1 : 0);

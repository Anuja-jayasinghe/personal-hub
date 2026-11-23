import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * Sharing, end to end (hosting 4.2's test person check; issue #139, C121):
 *   1. a TEST account signs in by itself: it is added as waiting and sees the demo, not real data;
 *   2. it is approved with Vehicles at See (the same rows Settings › People writes);
 *   3. after a reload it sees the hub with real data, Vehicles only, and nothing to change;
 *   4. given Vehicle documents at Add, it uploads a small TEST file to a vehicle (straight to storage, C115)
 *      and the file opens.
 * The TEST account, its rows and the TEST file are always deleted at the end, even when a step fails.
 */

const EMAIL = "hub-test-person@anujajay.com";
const SAMPLE_PLATE = "DEM-1234"; // only ever in the demo's sample data
// The plate is drawn in pieces (series, a dash bar, digits; C130), so find it by its accessible name.
const samplePlate = (page: Page) => page.getByRole("img", { name: `Plate ${SAMPLE_PLATE}` });
// The hub names uploads itself (issue #179), so the TEST file is found by its title; the old name stays in the
// clean-up for files left by runs before that change.
const TEST_TITLE = "TEST upload";
const TEST_FILE = "TEST upload.pdf";
const TEST_DATE = "2000-01-01";
/** The smallest file a PDF reader accepts, made here so the test needs no file on disk. */
const TEST_PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

const secret = process.env.E2E_CLERK_SECRET_KEY;
const databaseUrl = process.env.DATABASE_URL;

async function clerk<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Clerk ${method} ${path} answered ${res.status}`);
  return (await res.json()) as T;
}

/** Removes every TEST upload: the stored file first, then its row. */
async function deleteTestFiles(sql: postgres.Sql) {
  const rows = await sql<{ id: string; bucket: string; storage_path: string }[]>`select id, bucket, storage_path from attachments where title = ${TEST_TITLE} or file_name = ${TEST_FILE}`;
  if (rows.length === 0) return;
  const storage = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } }).storage;
  for (const r of rows) {
    const { error } = await storage.from(r.bucket).remove([r.storage_path]);
    if (error) throw new Error(`Could not delete the TEST file from storage: ${error.message}`);
    await sql`delete from attachments where id = ${r.id}`;
  }
}

async function deleteTestAccount(sql: postgres.Sql) {
  const found = await clerk<{ id: string }[]>("GET", `/users?email_address=${encodeURIComponent(EMAIL)}`);
  for (const u of found) await clerk("DELETE", `/users/${u.id}`);
  await sql`delete from people where email = ${EMAIL}`; // access_grants go with it (on delete cascade)
}

/** Signs the TEST account in with a one-time sign-in token, the way a magic link would. */
async function signIn(page: Page, userId: string) {
  const { token } = await clerk<{ token: string }>("POST", "/sign_in_tokens", { user_id: userId, expires_in_seconds: 300 });
  await page.goto(`/sign-in?__clerk_ticket=${token}`);
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 45_000 });
}

test.describe("sharing with a person who signs in by themselves", () => {
  test.skip(!secret || !databaseUrl || !process.env.SUPABASE_SECRET_KEY, "needs E2E_CLERK_SECRET_KEY, DATABASE_URL and SUPABASE_SECRET_KEY in .env.local");

  let sql: postgres.Sql;
  let userId: string;

  test.beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 1, prepare: false });
    await deleteTestFiles(sql); // a run that was cut short may have left these behind
    await deleteTestAccount(sql);
    const user = await clerk<{ id: string }>("POST", "/users", { email_address: [EMAIL], first_name: "TEST", last_name: "Person", skip_password_requirement: true });
    userId = user.id;
  });

  test.afterAll(async () => {
    if (sql) {
      await deleteTestFiles(sql);
      await deleteTestAccount(sql);
      await sql.end();
    }
  });

  test("waits in the demo, then sees only what was shared", async ({ page }) => {
    await signIn(page, userId);

    // 1. Waiting: the demo, with the sample data, and the person is on the list as waiting.
    await expect(page.getByRole("status").filter({ hasText: "waiting for the owner’s approval" })).toBeVisible();
    await expect(page.getByText(EMAIL)).toBeVisible();
    const [waiting] = await sql<{ id: string; status: string }[]>`select id, status from people where email = ${EMAIL}`;
    expect(waiting?.status).toBe("pending");
    await page.goto("/vehicles");
    await expect(samplePlate(page).first()).toBeVisible();

    // 2. Approve with Vehicles at See.
    await sql`update people set status = 'active' where id = ${waiting.id}`;
    await sql`insert into access_grants (person_id, area, level) values (${waiting.id}, 'vehicles', 'see')`;

    // 3. Real hub, Vehicles only.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Vehicles", level: 1 })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /sample data/i })).toHaveCount(0);
    await expect(samplePlate(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /add vehicle/i })).toHaveCount(0);

    const sections = page.getByRole("navigation", { name: "Sections" });
    await expect(sections.getByRole("link", { name: /vehicles/i })).toBeVisible();
    await expect(sections.getByRole("link", { name: /electricity/i })).toHaveCount(0);
    await expect(sections.getByRole("link", { name: /bills/i })).toHaveCount(0);

    await page.goto("/electricity");
    await expect(page.getByText("This page isn’t connected to anything.")).toBeVisible();
    await page.goto("/settings");
    await expect(page.getByText("This page isn’t connected to anything.")).toBeVisible();

    // 4. An upload: allowed to add documents, it puts a TEST file on a vehicle and the file opens.
    await sql`insert into access_grants (person_id, area, level) values (${waiting.id}, 'vehicle_documents', 'add')`;
    const [vehicle] = await sql<{ id: string }[]>`select id from vehicles where archived_at is null order by created_at limit 1`;
    test.skip(!vehicle, "the hub has no vehicle to attach the TEST file to");
    await page.goto(`/vehicles/${vehicle.id}?tab=documents`);
    await page.getByRole("button", { name: "Add document" }).click();
    await page.getByLabel("What is it?").selectOption("other");
    await page.getByLabel("Date").fill(TEST_DATE);
    await page.getByLabel("What is it called?").fill(TEST_TITLE);
    await page.locator('input[type="file"][name="file"]').setInputFiles({ name: TEST_FILE, mimeType: "application/pdf", buffer: TEST_PDF });
    await expect(page.getByText(/Saved as .*_test-upload_2000-01-01\.pdf/)).toBeVisible();
    await page.getByRole("button", { name: "Save document" }).click();
    // It shows under Other on the Documents tab, as a paper that opens in the viewer (issue #187).
    const paper = page.getByRole("button", { name: new RegExp(TEST_TITLE) });
    await expect(paper).toBeVisible({ timeout: 45_000 });

    // The hub named it PLATE_test-upload_2000-01-01.pdf, not the uploader's "TEST upload.pdf".
    const [stored] = await sql<{ id: string; size_bytes: number; mime_type: string; file_name: string }[]>`select id, size_bytes, mime_type, file_name from attachments where title = ${TEST_TITLE}`;
    expect(stored?.file_name).toMatch(/^[A-Z0-9-]+_test-upload_2000-01-01\.pdf$/);
    expect(stored?.mime_type).toBe("application/pdf");
    expect(Number(stored?.size_bytes)).toBe(TEST_PDF.length);
    const opened = await page.request.get(`/files/${stored.id}`);
    expect(opened.status()).toBe(200);
    expect((await opened.body()).subarray(0, 8).toString()).toBe("%PDF-1.4");
  });
});

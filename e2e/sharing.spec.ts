import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * Sharing, end to end (hosting 4.2's test person check; issue #139, C121):
 *   1. a TEST account signs in by itself: it is added as waiting and sees the demo, not real data;
 *   2. it is approved with Vehicles at See (the same rows Settings › People writes);
 *   3. after a reload it sees the hub with real data, Vehicles only, and nothing to change.
 * The TEST account and its rows are always deleted at the end, even when a step fails.
 */

const EMAIL = "hub-test-person@anujajay.com";
const SAMPLE_PLATE = "DEM-1234"; // only ever in the demo's sample data

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
  test.skip(!secret || !databaseUrl, "needs E2E_CLERK_SECRET_KEY and DATABASE_URL in .env.local");

  let sql: postgres.Sql;
  let userId: string;

  test.beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 1, prepare: false });
    await deleteTestAccount(sql); // a run that was cut short may have left it behind
    const user = await clerk<{ id: string }>("POST", "/users", { email_address: [EMAIL], first_name: "TEST", last_name: "Person", skip_password_requirement: true });
    userId = user.id;
  });

  test.afterAll(async () => {
    if (sql) {
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
    await expect(page.getByText(SAMPLE_PLATE).first()).toBeVisible();

    // 2. Approve with Vehicles at See.
    await sql`update people set status = 'active' where id = ${waiting.id}`;
    await sql`insert into access_grants (person_id, area, level) values (${waiting.id}, 'vehicles', 'see')`;

    // 3. Real hub, Vehicles only.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Vehicles", level: 1 })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /sample data/i })).toHaveCount(0);
    await expect(page.getByText(SAMPLE_PLATE)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /add vehicle/i })).toHaveCount(0);

    const sections = page.getByRole("navigation", { name: "Sections" });
    await expect(sections.getByRole("link", { name: /vehicles/i })).toBeVisible();
    await expect(sections.getByRole("link", { name: /electricity/i })).toHaveCount(0);
    await expect(sections.getByRole("link", { name: /bills/i })).toHaveCount(0);

    await page.goto("/electricity");
    await expect(page.getByText("This page isn’t connected to anything.")).toBeVisible();
    await page.goto("/settings");
    await expect(page.getByText("This page isn’t connected to anything.")).toBeVisible();
  });
});

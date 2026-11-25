import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * Signing in from an invitation, end to end (issue #236, DECISIONS C154; same setup as sharing.spec.ts):
 *   1. the sign-up page with `?invite=<code>` welcomes the invited person ("invited you") and never shows the
 *      invited address; an unknown code and no code show no banner at all;
 *   2. a TEST account that signs in with the invited address (verified by Clerk's API, like a magic link)
 *      turns the `invited` placeholder into `active` with no approval, sees the real hub (not the demo) with
 *      only what was granted (Vehicles, see), and gets "not found" for an area it was not given and for
 *      Settings › People.
 * The expired path (a past end date makes the sign-in an ordinary request) is NOT run live: it would send the
 * owners the real "someone asked for access" push on every deploy, and nothing in the app can tell a TEST
 * address from a real one. PGlite tests cover it (src/lib/auth-invitations.test.ts).
 *
 * The invitation row is written straight to the database, the way `createInvitation` leaves it, so the test
 * never calls the email sender: it sends no email at all. The TEST account, the row (its grants go with it) and
 * any push rows for the address are always deleted at the end, even when a step fails.
 */

const EMAIL = "hub-test-invitee@anujajay.com";
const INVITED_BY = "e2e@test.invalid";
const SAMPLE_PLATE = "DEM-1234"; // only ever in the demo's sample data
const samplePlate = (page: Page) => page.getByRole("img", { name: `Plate ${SAMPLE_PLATE}` });
const banner = (page: Page) => page.getByRole("status").filter({ hasText: "invited you" });
const newCode = () => randomBytes(16).toString("base64url"); // 22 characters, like the hub's own invite codes

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
  await sql`delete from push_subscriptions where recipient = ${EMAIL}`;
  await sql`delete from people where email = ${EMAIL}`; // access_grants go with it (on delete cascade)
}

/** Signs the TEST account in with a one-time sign-in token, the way a magic link would. */
async function signIn(page: Page, userId: string) {
  const { token } = await clerk<{ token: string }>("POST", "/sign_in_tokens", { user_id: userId, expires_in_seconds: 300 });
  await page.goto(`/sign-in?__clerk_ticket=${token}`);
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 45_000 });
}

test.describe("signing in from an invitation", () => {
  test.skip(!secret || !databaseUrl, "needs E2E_CLERK_SECRET_KEY and DATABASE_URL in .env.local");

  let sql: postgres.Sql;
  let userId: string;
  const code = newCode();

  test.beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 1, prepare: false });
    await deleteTestAccount(sql); // a run that was cut short may have left these behind
    // The placeholder exactly as `createInvitation` leaves it, without sending any email.
    const [person] = await sql<{ id: string }[]>`
      insert into people (email, status, invited_by, inviter_name, invite_code, invite_expires_at, invite_sent_at, invite_send_count)
      values (${EMAIL}, 'invited', ${INVITED_BY}, 'TEST', ${code}, now() + interval '14 days', now(), 1)
      returning id`;
    await sql`insert into access_grants (person_id, area, level) values (${person.id}, 'vehicles', 'see')`;
    const user = await clerk<{ id: string }>("POST", "/users", { email_address: [EMAIL], first_name: "TEST", last_name: "Invitee", skip_password_requirement: true });
    userId = user.id;
  });

  test.afterAll(async () => {
    if (sql) {
      await deleteTestAccount(sql);
      await sql.end();
    }
  });

  test("the sign-up link welcomes them, and signing in activates exactly what was granted", async ({ page }) => {
    // 1. The sign-up page, signed out: a valid code shows the welcome, never the address; others show nothing.
    await page.goto(`/sign-up?invite=${code}`);
    await expect(banner(page)).toBeVisible();
    await expect(page.getByText(EMAIL)).toHaveCount(0);
    // Opening the link marks the invitation opened (after the response, so wait for it).
    await expect
      .poll(async () => (await sql<{ opened: boolean }[]>`select invite_opened_at is not null as opened from people where email = ${EMAIL}`)[0]?.opened, { timeout: 20_000 })
      .toBe(true);

    await page.goto(`/sign-up?invite=${newCode()}`);
    await expect(page.getByRole("heading", { name: /join the hub/i })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: /join the hub/i })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);

    // Looking at the link changes nothing about the placeholder: it still has no power.
    const [before] = await sql<{ status: string }[]>`select status from people where email = ${EMAIL}`;
    expect(before?.status).toBe("invited");

    // 2. Sign in as the invited address: active at once, with exactly the stored grants.
    await signIn(page, userId);

    // The real hub, not the demo: no "Sample data" banner, no sample plate, Vehicles reachable.
    await page.goto("/vehicles");
    await expect(page.getByRole("heading", { name: "Vehicles", level: 1 })).toBeVisible();
    // The first request after sign-in is what activates the row, so read it back once the page has rendered.
    const [after] = await sql<{ status: string; grants: number }[]>`
      select p.status, (select count(*)::int from access_grants g where g.person_id = p.id) as grants from people p where p.email = ${EMAIL}`;
    expect(after?.status).toBe("active");
    expect(after?.grants).toBe(1);
    await expect(page.getByRole("status").filter({ hasText: /sample data/i })).toHaveCount(0);
    await expect(samplePlate(page)).toHaveCount(0);
    const sections = page.getByRole("navigation", { name: "Sections" });
    await expect(sections.getByRole("link", { name: /vehicles/i })).toBeVisible();

    // What was not granted answers "not found", as if it were not there.
    await page.goto("/tasks");
    await expect(page.getByText("This page isn’t connected to anything.")).toBeVisible();
    await page.goto("/settings/people");
    await expect(page.getByText("This page isn’t connected to anything.")).toBeVisible();
  });
});

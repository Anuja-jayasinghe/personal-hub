# Hosting the hub (Phase 4.2)

The hub runs on Vercel at **https://hub.anujajay.com** (DECISIONS C115). Login is Clerk; the data stays in
Supabase (database and private file storage, region ap-southeast-1). Every outside step is confirmed with the
owner before it is done. Secrets are never printed, committed or pasted into chat.

## Done

- Code ready for Vercel: uploads go straight from the browser to private storage through one-time links
  (Vercel caps a request at 4.5 MB); one database connection per server copy, prepared statements off.
- The app runs in Vercel's **Singapore** region (`vercel.json`), next to the database.
- `vercel.json` also sets the framework to **Next.js**: the project was created with the preset "Other", which made the first deploy answer 404 everywhere (issue #130).
- Vercel project **personal-hub** (team anuja-jayasinghes-projects), linked from this folder (`.vercel/`, git-ignored).
- Production settings on Vercel: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (sensitive), `ALLOWED_EMAILS` (sensitive),
  `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `DATABASE_URL` (sensitive; Supabase's
  **session pooler**, port 5432, the same address as `.env.local`). Not the transaction pooler (port 6543): it hung
  every signed-in page, because it cannot take more than two queries at once on one connection (issue #135, C119).

- **Preview settings** (C133, issue #174): previews use **real data**. Preview has the same `DATABASE_URL`,
  `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ALLOWED_EMAILS` and sign-in/up paths as Production, but **Clerk's development
  keys** (`pk_test` / `sk_test`, as in `.env.local`), because the production Clerk instance only works on
  `hub.anujajay.com`. `CRON_SECRET` is Production only. **Add every new setting to both Production and Preview**
  (`vercel env add NAME --environment production,preview`), or previews answer 500 again. Preview code reads and
  writes the live database and files: test with labelled TEST rows. Previews stay behind Vercel's login;
  `vercel curl <path> --deployment <url>` reaches one from the terminal.

## Set up (2026-11-19 and 20)

1. **Clerk production instance** for `hub.anujajay.com` (C117): sign-up open (the hub gates), password off, email
   code and Google on (your own Google OAuth client, origin `https://hub.anujajay.com`, redirect
   `https://clerk.hub.anujajay.com/v1/oauth_callback`).
2. **DNS at Cloudflare**, all DNS only: `hub` to Vercel and Clerk's five records under `hub`.
3. **Clerk keys on Vercel**, the GitHub repo connected (every merge to `main` deploys), the domain added.
4. **Checks**: the owner signed in with Google and sees the real hub (after C119's pooler fix); signed-out
   visitors see the demo; the live end-to-end test below passed, including a file upload (issue #141).

## Keeping Supabase awake (C127)

A free Supabase project pauses after 7 days without database activity. Since C139 the daily notification run keeps
it awake: Vercel Cron calls `/api/notify` once a day (`0 2 * * *` UTC, 07:30 to 08:29 in Colombo, `vercel.json`),
which reads the reminders and the send log every morning (the old every-3-days `/api/keep-awake` is gone). It needs
`CRON_SECRET` (sensitive, on Vercel, Production only); without it the route refuses every call. It only runs on
Production (`VERCEL_ENV=production`): previews use real data, so there it answers "skipped" and does nothing. It
writes the `notifications` send log (dry runs for a channel until it is built, set up and switched on in Settings) and answers with counts only.
Vercel's dashboard lists the job under *Settings › Cron Jobs*.

## iPhone push (N.3, C140)

Web push to the hub added to the iPhone's Home Screen needs three settings, on **Production AND Preview**
(`vercel env add NAME --environment production,preview`):

| Setting | What it is |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | The public half of the VAPID key pair; the browser subscribes with it (public by design). |
| `VAPID_PRIVATE_KEY` | The private half, which signs every push. **Sensitive**: mark it sensitive on Vercel, never print or commit it. |
| `VAPID_SUBJECT` | `https://hub.anujajay.com` (how a push service can reach the sender; never a personal email). |

The pair was generated on this computer with web-push's `generateVAPIDKeys()` and is in `.env.local`; copy the same
pair to Vercel (a new pair would cut off every subscribed device). If any of the three is missing, push stays "not
set up": Settings cannot turn it on and the daily run logs pushes as dry runs. Previews never send from the daily run
(it skips them), but Settings there can subscribe a device and send a test. **Previews share the real database**, so a
device subscribed on a preview is stored like any other, but its service worker and Home Screen app belong to the
preview's address: a push opens the preview, and it stops working when the preview goes. Subscribe on
`hub.anujajay.com`, and remove preview devices from the list.

**Going live, in this order** (N.3, C140):

1. Apply the migrations `0017_amazing_omega_sentinel.sql` (the `push_subscriptions` table) and
   `0018_tricky_avengers.sql` (its `gone_at` column) with `pnpm db:migrate`. Both are additive. The code reads the
   table, so the table comes first (if it is missing, Settings shows push as not set up instead of breaking).
2. Set the three settings above on Vercel (Production and Preview).
3. Merge, or redeploy if already merged: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is put into the build, so a deploy made
   before it was set does not have it.

## Plan-ahead email (N.2, C141)

The run sends the plan-ahead email through **Resend** (its REST API, no SDK) from `hub <notify@mail.hub.anujajay.com>`,
on the sending subdomain `mail.hub.anujajay.com` verified in Resend. Two settings, both **sensitive, Production
only** (not on Preview, unlike most settings: a preview must never send email):

- `RESEND_API_KEY`: a Resend key with sending access only, restricted to `mail.hub.anujajay.com`;
- `NOTIFY_EMAIL_TO`: the owner's delivery address (a tagged Gmail address). Never in the repo.

Without both, or until the owner switches email on in *Settings › Notifications*, email stays a dry run. Previews do
not have them, so there Settings shows email as "Not set up" and the test button is not offered.

The Gmail filter matches the **sender** (From `notify@mail.hub.anujajay.com`), never only the delivery address: the
tag is easy to guess, and a filter on To with "Never send it to Spam" would let anyone's mail past the spam filter.

## Pushes that need no due date (N.4, C142)

The daily run also pushes when a meter nears or crosses its slab limit and when a meter reading is overdue; **no new setting and no migration**. "Someone asked for access" is sent right away (from Next's `after()`, when a stranger is first recorded as pending) **only on Production**, only to the `ALLOWED_EMAILS` owners, only after 09:00 Colombo and only if no push has gone to that owner today; otherwise the next daily run includes it in the day's one push. Previews and local development share the real database but never send it. It needs push to be set up and switched on like every other push (otherwise it is logged as a dry run).

## End-to-end test (`pnpm e2e`, C121)

`e2e/sharing.spec.ts` runs against the live site with Playwright: a TEST account (`hub-test-person@anujajay.com`,
no email is sent) signs in with a one-time sign-in token, sees the demo while waiting, is approved with Vehicles at
See, then sees only Vehicles with real data; given Vehicle documents at Add it uploads a small `TEST upload.pdf` to the
first vehicle and checks that it opens. The account, its rows and the TEST file are deleted at the end, even when a
step fails. It also needs `SUPABASE_SECRET_KEY` (to delete the TEST file from storage). It needs in `.env.local`: `E2E_CLERK_SECRET_KEY`, a separate production secret key named **e2e-local** in
the Clerk dashboard (delete it there to switch the tests off), and `DATABASE_URL`. `E2E_BASE_URL` points it at
another address.

## Notes

- Supabase's free plan pauses a project after a week without use; opening the hub wakes it within a minute.
- Backups stay `pnpm backup` on this computer until 4.4 adds the scheduled one.
- Never remove the `anujajay.com` domain from Vercel: the portfolio and other subdomains use it.

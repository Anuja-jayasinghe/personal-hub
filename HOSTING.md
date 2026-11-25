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
  `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `DATABASE_URL` (sensitive; see the
  pooler paragraph below: the transaction pooler, port 6543, from v1.0.0; before that the session pooler, port 5432, C119).

  **The live site uses the transaction pooler from v1.0.0 (issue #278, C168).** The session pooler allows only 15
  clients in all (issue #253), which a burst of requests filled. The transaction pooler (port 6543) has far more
  room but hung in C119 when queries queued on one connection. The database client now tells the driver to send
  **one query at a time per connection** (`max_pipeline: 1`) whenever `DATABASE_URL` is on port 6543 (`src/db/index.ts`),
  which tested fine at any load (2026-11-25: 100 concurrent queries on 8 connections in 0.9 s; the app's own client,
  60 concurrent queries in 1.2 s). On the live site `DATABASE_URL` (sensitive, Production and Preview) is
  the **transaction pooler** string (port 6543, same user and password as the session one) and the client uses 4
  connections per server copy (`DATABASE_MAX_CONNECTIONS` overrides it, 1 to 40). To go back, restore the port 5432
  address in Vercel and redeploy (the client then behaves exactly as before). **Keep `.env.local` on port 5432**:
  migrations (`pnpm db:migrate`) and local scripts should use the session pooler.

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
DMARC on `mail.hub.anujajay.com` is `p=quarantine; adkim=s` (strict alignment), so mail that fails it goes to spam
and the sender-matching Gmail filter is what keeps the real ones in the inbox.

A message Resend refuses (400, 401, 403, 404, 422 or 429) is logged `failed` and retried on the next morning's run
while it is still timely, **but at most 3 times**; after that it is never planned again. So a wrong `NOTIFY_EMAIL_TO`
(Resend answers 422) loses a notice after three mornings: fix the configuration promptly. **Email is the owners'
only** (N.5, C144): shared people are never emailed, whatever their grants; they get pushes.

## Invitations (issue #236, C154)

Settings › People › Invite someone emails a sign-up link (`<site>/sign-up?invite=<code>`) through the same Resend setup:
**no new setting**, it only needs `RESEND_API_KEY` (Production only, as above) and sends from the same
`hub <notify@mail.hub.anujajay.com>`. **Only Production sends**: on a preview or locally the invitation is saved and
the owner is told the email is only sent from the live site. The link's host is `siteUrl` in `app.config.ts`. Apply
migration 0020 before merging: the sign-in check reads the new `invited` and `expired` states and columns.

## Pushes that need no due date (N.4, C142)

The daily run also pushes when a meter nears or crosses its slab limit and when a meter reading is overdue; **no new setting and no migration**. "Someone asked for access" is sent right away (from Next's `after()`, when a stranger is first recorded as pending) **only on Production**, only to the `ALLOWED_EMAILS` owners, only after 09:00 Colombo and only if no push has gone to that owner today; otherwise the next daily run includes it in the day's one push. Two sign-ups at the same instant send one push (an atomic per-owner, per-day claim in `app_settings`). A sign-up at 08:45 Colombo waits for the next morning's run, because instant pushes start at 09:00 and that morning's run has gone. On the first run after this ships, a meter already near or over its limit gets one push, and anyone who signed up within the last 7 days and is still pending gets one batched push; the 7-day windows are a design choice. Previews and local development share the real database but never send it. It needs push to be set up and switched on like every other push (otherwise it is logged as a dry run).

## Notifications for shared people (N.5, C144)

The daily run also pushes to **active shared people** who have turned pushes on for a device: only for what their grants
let them see, push only (no email, ever, and never a sign-up request). **One migration, apply it BEFORE merging:**
`0019_overconfident_lady_mastermind.sql` adds `people.notifications_enabled boolean not null default true` with
`pnpm db:migrate`. It is additive, so the code already live keeps working with the column in place; the other way round
(code first) a stranger's first sign-in (the insert that records them as waiting), "Add person" and Settings › People
all fail until it is applied. Only an existing person's sign-in, a person's own page (it cannot say "paused") and the
owners' daily run (it carries on without the people) survive. So: migrate first, then merge. No new setting. A person turns pushes on at
`/notifications` (profile menu or More), on `hub.anujajay.com` and with the hub on their iPhone's Home Screen; the owner
sees each person's devices in Settings › People and can switch a person's notifications off there.

## End-to-end test (`pnpm e2e`, C121)

`e2e/sharing.spec.ts` runs against the live site with Playwright: a TEST account (`hub-test-person@anujajay.com`,
no email is sent) signs in with a one-time sign-in token, sees the demo while waiting, is approved with Vehicles at
See, then sees only Vehicles with real data; given Vehicle documents at Add it uploads a small `TEST upload.pdf` to the
first vehicle and checks that it opens. The account, its rows and the TEST file are deleted at the end, even when a
step fails. It also needs `SUPABASE_SECRET_KEY` (to delete the TEST file from storage). It needs in `.env.local`: `E2E_CLERK_SECRET_KEY`, a separate production secret key named **e2e-local** in
the Clerk dashboard (delete it there to switch the tests off), and `DATABASE_URL`. `E2E_BASE_URL` points it at
another address.

`e2e/invitation.spec.ts` (C159) checks the invitation sign-in the same way with its own TEST address
(`hub-test-invitee@anujajay.com`): it writes the `invited` row and its Vehicles grant straight to the database (no email
is sent), checks the sign-up page's welcome and that an unknown code shows nothing, signs the TEST account in and checks
the row became `active`, the real hub shows with Vehicles only and the other sections answer not found, then deletes the
account and the row. The expired invitation is not run live (it would send the owners the real sign-up push); the PGlite
tests cover it. The workflow runs the whole `e2e/` folder, so it runs after each production deploy with no setup of its own.

## Security headers (C143)

Every response carries `nosniff`, a strict referrer policy, a locked-down permissions policy (only the hub itself may use the camera) and `X-Robots-Tag: noindex, nofollow, noarchive`; pages cannot be framed (`frame-ancestors 'none'`, and `'self'` only for `/files/*`). They come from `next.config.ts` (`src/config/security-headers.ts`), so they apply on Vercel with nothing to set in the dashboard. HSTS is Vercel's own (`max-age=63072000`); do not add `includeSubDomains` or `preload`, because other subdomains of the domain are not part of this project. `shadcn` is a dev dependency: Vercel installs those for the build, so keep "Install command" at its default.

## Notes

- Supabase's free plan pauses a project after a week without use; opening the hub wakes it within a minute.
- Backups stay `pnpm backup` on this computer until 4.4 adds the scheduled one.
- Never remove the `anujajay.com` domain from Vercel: the portfolio and other subdomains use it.

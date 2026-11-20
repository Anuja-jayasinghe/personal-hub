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

## Set up (2026-11-19 and 20)

1. **Clerk production instance** for `hub.anujajay.com` (C117): sign-up open (the hub gates), password off, email
   code and Google on (your own Google OAuth client, origin `https://hub.anujajay.com`, redirect
   `https://clerk.hub.anujajay.com/v1/oauth_callback`).
2. **DNS at Cloudflare**, all DNS only: `hub` to Vercel and Clerk's five records under `hub`.
3. **Clerk keys on Vercel**, the GitHub repo connected (every merge to `main` deploys), the domain added.
4. **Checks**: the owner signed in with Google and sees the real hub (after C119's pooler fix); signed-out
   visitors see the demo; the live end-to-end test below passed, including a file upload (issue #141).

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

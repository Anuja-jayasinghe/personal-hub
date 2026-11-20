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

## Still to do, in order

1. **Clerk production instance** for `hub.anujajay.com` (one-way). Created through the Clerk connection once the
   owner has reconnected it (`/mcp`, then **clerk**), or by the owner in the Clerk dashboard. Settings: sign-up
   **open** (the hub gates: people not approved wait, later see the demo), password off, email code on, Google on.
2. **DNS at Cloudflare** for `anujajay.com`, all **DNS only** (grey cloud, not proxied):
   - the records Clerk lists for production (usually CNAMEs for `clerk.hub`, `accounts.hub`, `clkmail.hub` and two
     `_domainkey` records); copy them exactly from the Clerk dashboard;
   - `hub` CNAME to `cname.vercel-dns.com`, after the domain is added to the Vercel project.
3. **Google sign-in** (the owner, in the Google Cloud console):
   1. Create a project (or use one), then *APIs & Services › OAuth consent screen*: External, app name **hub**,
      your email as support and developer contact; add `anujajay.com` as an authorised domain; publish it.
   2. *Credentials › Create credentials › OAuth client ID*, type **Web application**.
      - Authorised JavaScript origin: `https://hub.anujajay.com`
      - Authorised redirect URI: the one Clerk shows under *Configure › SSO connections › Google › Use custom
        credentials* (it looks like `https://clerk.hub.anujajay.com/v1/oauth_callback`).
   3. Paste the client ID and client secret into that same Clerk screen yourself; they never need to pass through
      chat or this repo.
4. **Clerk keys on Vercel**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (sensitive) from the
   production instance, added without printing.
5. **Connect the GitHub repo** to the Vercel project and **deploy** `main` to production. Add the domain
   `hub.anujajay.com` to the project.
6. **Checks** on the live site: the owner signs in (email code and Google); Home, Electricity, Bills, Vehicles,
   Settings load; a file upload works; a TEST person signs in and sees "waiting for approval", is approved with
   one section, sees only that, and is then removed. A signed-out visit to any page goes to sign-in.

## Notes

- Supabase's free plan pauses a project after a week without use; opening the hub wakes it within a minute.
- Backups stay `pnpm backup` on this computer until 4.4 adds the scheduled one.
- Never remove the `anujajay.com` domain from Vercel: the portfolio and other subdomains use it.

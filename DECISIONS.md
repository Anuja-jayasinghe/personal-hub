# anuja-hub — Decision Log

The single place to track what has been **confirmed**, what is **pending**, and what was **rejected**.
Rules for this project:

- Nothing is created, installed or run without a confirmed decision here.
- Anything marked **EXTERNAL** (runs anywhere other than this Mac) needs its own explicit confirmation, and needs it again if it changes.
- Every answer gets recorded here with its date.

Legend: ✅ Confirmed · ⏳ Pending · ❌ Rejected · 🌐 EXTERNAL

---

## ✅ Confirmed

| # | Date | Decision | Notes |
|---|------|----------|-------|
| C1 | 2026-11-12 | MVP scope: Vehicles + Electricity log, Bills/Subscriptions next | Built as a "super app" shell with modules |
| C2 | 2026-11-12 | Project name/folder: `anuja-hub` at `/Users/anujaj/gitProject/anuja-hub` | Working name only |
| C3 | 2026-11-12 | Branding decided later, separately | Everything parameter-based: app name, colours, fonts, logo, icons live in one config + theme tokens |
| C4 | 2026-11-12 | **Web app runs locally**; data services are real hosted ones from the start | Replaces "everything local": you work from two computers and both need the same data |
| C5 | 2026-11-12 | Stack: **Next.js + TypeScript** | Tailwind + shadcn/ui, Drizzle ORM, PWA |
| C6 | 2026-11-12 | Reminders: **in-app only** for the MVP | Dashboard "due soon" + next-30-days list; email later |
| C7 | 2026-11-12 | 🌐 Database + file storage: **Supabase** (hosted Postgres + Storage) | You create the account and project. Free projects pause after 7 days unused; resume them from the dashboard |
| C8 | 2026-11-12 | Git: initialise a repo + 🌐 **private GitHub repo** as the remote | Syncs code between your two computers. `.env*`, DB dumps and uploads are never committed |
| C9 | 2026-11-12 | Package manager: **pnpm** | 🌐 Package installs come from the npm registry |
| C10 | 2026-11-12 | Login: **none** | Dev-only, single user |
| C11 | 2026-11-12 | Access: **anyone on the network** can open the local app (listens on LAN) | You accepted the risk: anyone on the same Wi-Fi can read and change data |
| C12 | 2026-11-13 | PayLedger retired; its Supabase free-tier slot is now free for this project | Verified 2026-11-13 via CLI: the account has only SolarEdge (`mqrlrkerjtfsjypaeppf`, ap-southeast-1), so one slot is open |
| C13 | 2026-11-13 | Supabase CLI 3.1.0 stays logged in account-wide on this Mac | Your choice from the PayLedger session. Per project: `supabase link --project-ref <ref>`. The Keychain token is never read directly |
| C14 | 2026-11-13 | `anuja-hub` is a working name only; a real name is coming "very soon" | Keep it out of public-facing text (GitHub repo name, README, descriptions) until chosen. Brand stays parameter-based (C3) |
| C15 | 2026-11-13 | Real name not chosen yet: use a **neutral name** for the repo and Supabase project, rename later | Neutral name confirmed: **`personal-hub`** (for both) |
| C16 | 2026-11-13 | Supabase region: **Singapore (ap-southeast-1)** | Same as SolarEdge |
| C17 | 2026-11-13 | I create the Supabase project with the CLI | I confirm the exact command with you first. DB password generated, stored only in `.env.local` (git-ignored) |
| C18 | 2026-11-13 | I create the private GitHub repo with `gh` | `gh` is logged in as `Anuja-jayasinghe` (scopes: repo, workflow…). I confirm the exact name first and ask again before the first push |
| C19 | 2026-11-13 | Supabase access is **server-side only** | Connection string + service key live in `.env.local` on each computer, used by server code only. No Supabase key reaches the browser, so no row-level-security setup is needed for the MVP |
| C20 | 2026-11-13 | Reminder lead times: **30, 14, 7, 1 and 0 days** | In-app flags; adjustable per renewal type later |
| C21 | 2026-11-13 | Currency: **LKR** | A single setting in `app.config.ts`, not hard-coded in screens |
| C22 | 2026-11-13 | Electricity tariff: **add later**; units only for now | The "since last bill" card shows units, days, daily average and projected units. Cost estimate turns on once a tariff is entered in settings (tariff table stays in the data model, versioned by effective date) |
| C23 | 2026-11-13 | Renewal types tracked: **Revenue license, Insurance, Emission test, Driving license** | Types are data, not code, so more can be added in settings. Driving license belongs to you (a person-level item), not to one vehicle |
| C24 | 2026-11-13 | Service reminders use **date only** | No odometer-based due. The odometer field stays optional on service records for your history, but nothing reminds by km |
| C25 | 2026-11-13 | Time zone: **Asia/Colombo** | Set in `app.config.ts` (`timeZone`); decides what "today" means for reminders |
| C26 | 2026-11-13 | DB route: **Supabase session pooler** (`aws-0-ap-southeast-1.pooler.supabase.com:5432`) for the app and migrations | Direct host is IPv6-only |
| C27 | 2026-11-13 | **Row-level security on every table, no policies** | Enabled in the same migration that creates each table; blocks the public Data API path, server connection unaffected |
| C28 | 2026-11-13 | Step 0.5 scope: **Drizzle setup + `app_settings` table only** | Shared tasks/notes/attachments stay in step 0.7 |
| C30 | 2026-11-13 | Navigation: **shadcn Sidebar component** | Collapsible sidebar on desktop; on phones it becomes a slide-out panel opened by a menu button (no separate bottom tab bar unless you ask later). Adds several shadcn components |
| C31 | 2026-11-13 | Theme switch: **next-themes** package | 🌐 one npm dependency; light / dark / system, remembered in the browser |
| C32 | 2026-11-13 | Dashboard skeleton cards: **Due soon** and **Electricity since last bill** only | No quick-add or module-shortcut cards for now; module links live in the sidebar |
| C29 | 2026-11-13 | "Don't ask again, run" — standing go-ahead for the remaining step 0.5 sub-steps (0.5a–0.5f) | Scope is step 0.5 only. Commits, pushes and later steps still get their own confirmation unless you say otherwise |

## ⏳ Pending — needs your answer

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| P9 | Branding (name, colours, fonts, logo) | Separate session later | — |

## 🌐 External services

| Service | Purpose | Status |
|---------|---------|--------|
| Supabase (Postgres + Storage) | Shared data + uploaded documents across both computers | ✅ Approved (C7) — project `personal-hub` created 2026-11-13 (ref `qfhwazfnentlweackpqa`, ap-southeast-1) |
| GitHub (private repo) | Code sync between both computers | ✅ Approved (C8) — private repo `Anuja-jayasinghe/personal-hub` created 2026-11-13, empty, nothing pushed |
| npm registry via pnpm | Download open-source packages | ✅ Approved (C9) — I'll still say when an install runs |
| Email provider (Gmail SMTP / Resend) | Reminder emails | ⏳ Deferred (C6) |
| Hosting the web app (e.g. Vercel) | Access from anywhere | ⏳ Deferred (C4) |

## 🛠 Step progress

| Step | Date | Status | What was done |
|------|------|--------|---------------|
| 0.1 | 2026-11-12 | ✅ Done | `git init -b main` (local, no remote yet) + `.gitignore` excluding `.env*` (except `.env.example`), keys, `data/`, `backups/`, `uploads/`, dumps, `node_modules`, `.next`. Nothing committed yet |
| 0.2 | 2026-11-13 | ✅ Done | Supabase project `personal-hub` created via CLI (ref `qfhwazfnentlweackpqa`, Singapore). Random DB password saved only in `.env.local` (git-ignored; never printed). Private GitHub repo `personal-hub` created and set as `origin`; no push. Note: the CLI needed `--yes` for hosted changes, applied only after your approval of the exact command |
| 0.2b | 2026-11-13 | ✅ Done | `supabase link --project-ref qfhwazfnentlweackpqa` run in this folder (local state only, in git-ignored `supabase/.temp`). First local commit of the planning files; nothing pushed |
| 0.9a | 2026-11-13 | ✅ Done | First push: `main` → `origin/main` (commit aaf784d: `.gitignore`, `DECISIONS.md`, `PLAN.md`). Repo verified PRIVATE. No secrets in the push |
| 0.3 | 2026-11-13 | ✅ Done (uncommitted) | 🌐 npm registry via pnpm. Next.js 16.4.6 + React 19.3 + TypeScript 5.9 + Tailwind 4.3 + ESLint scaffolded in a scratch folder, then copied in (your `.gitignore` kept); `src/` layout, `@/*` alias. shadcn/ui initialised with its defaults (CSS-variable theming, creates `components.json`, `src/components/ui/button.tsx`, `src/lib/utils.ts`, and edits `src/app/globals.css` and fonts). Next.js telemetry disabled for these runs. `pnpm build` and `pnpm lint` both pass. Not yet pushed |
| 0.3a | 2026-11-13 | ✅ Done | Scaffold committed (b29d87b) and pushed to private `Anuja-jayasinghe/personal-hub` (verified PRIVATE). Scan of staged changes found no secrets |
| 0.4 | 2026-11-13 | ✅ Done (uncommitted) | Local only, no new packages. **Re-brand points:** `src/config/app.config.ts` (name, tagline, logo, currency LKR, time zone, reminder lead times, module list with on/off flags) · `src/theme/theme.css` (brand hue/chroma/radius primitives; all colours derived from them, light + dark + status colours) · `src/theme/fonts.ts` (typefaces; Geist placeholder). Also added `src/components/brand/logo.tsx`, `src/lib/format.ts` (money + date in app locale), a placeholder home page, and `.claude/launch.json`. Removed the unused Next.js template images. Placeholder name "Personal Hub", blue hue 215. `pnpm build`, lint and `tsc` pass; viewed in the browser pane at :3100 with no console errors; changing `--brand-hue` recoloured the primary as intended |
| 0.4a | 2026-11-13 | ✅ Done | Step 0.4 committed (4ea8163) and pushed to private `personal-hub` (verified PRIVATE). `.claude/launch.json` deliberately not committed |
| 0.5 | 2026-11-13 | ✅ Done | 🌐 npm: `drizzle-orm` 0.45.4, `postgres` 4.1.1, `server-only` 0.0.1, dev `drizzle-kit` 0.31.11. Added `drizzle.config.ts`, `src/db/index.ts` (server-only client), `src/db/schema/` (`app_settings`, RLS on), `.env.example`, `scripts/db-check.mjs`, scripts `db:generate/migrate/studio/check` + `typecheck`. `DATABASE_URL` (session pooler + your password) written to `.env.local` only (git-ignored, mode 600, never printed). 🌐 Supabase write: migration `drizzle/0000_romantic_warbird.sql` applied (creates `app_settings`, enables RLS). Verified: connection OK, RLS on, write/read OK, public `anon` role sees 0 rows, cleanup OK; the Drizzle client also worked through a temporary Next.js route that was then deleted. `typecheck` and lint pass |
| 0.5a | 2026-11-13 | ✅ Done | Step 0.5 committed (65aad4a) and pushed to private `personal-hub` (verified PRIVATE). Staged changes scanned: your DB password appears 0 times; only `.env.example` (placeholders) was pushed, not `.env.local` |
| 0.6 | 2026-11-13 | ✅ Done | 🌐 npm: `next-themes` 0.4.6; shadcn added `sidebar`, `sheet`, `tooltip`, `card`, `badge`, `separator`, `input`, `skeleton` and `use-mobile` (the generated `use-mobile.ts` was edited to satisfy the lint rule). Shell in route group `src/app/(app)/`: collapsible sidebar built from `app.config.ts` modules, slide-out on phones; pages Home (Due soon + Electricity since last bill empty states), Vehicles and Electricity stubs (404 if the module is switched off; `/bills` returns 404), Settings (light/dark/system + read-only config). `allowedDevOrigins` = `10.*.*.*`, `192.168.*.*`, `*.local`. Verified: lint, typecheck, build pass; desktop, phone width (slide-out menu) and light/dark switch checked in the browser pane, no console errors; pages return 200 via this Mac's LAN address 10.100.8.171. **Not verified:** opening it from your phone; the `AnujaJ-2.local` name did not resolve from this Mac |

## ❌ Rejected

| # | Date | Decision | Why |
|---|------|----------|-----|
| R1 | 2026-11-12 | Cloud hosting of the web app from day one | Web app stays local |
| R2 | 2026-11-12 | Ballerina API + React UI | Next.js chosen |
| R3 | 2026-11-12 | Email reminders in MVP | In-app first |
| R4 | 2026-11-12 | Local SQLite / Postgres in Docker | Hosted DB needed for two computers |
| R5 | 2026-11-12 | Local-only git with no remote | Two computers need sync |
| R6 | 2026-11-12 | Passcode login | Dev-only, single user |

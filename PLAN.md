# anuja-hub — Build Plan

A personal "super app" made of modules that plug into one shell. Decisions are tracked in [DECISIONS.md](DECISIONS.md).
Each step below has a **gate**: it starts only after you approve it.

## Architecture

```
Shell        : Home dashboard · Navigation · Search · Settings
Shared       : Reminders engine · Tasks · Notes · Attachments · Tags
Modules      : Vehicles · Electricity · Bills (next) · … future
Config       : app.config.ts (name, logo, enabled modules) + theme tokens (colours, fonts, radius)
```

- **Module contract**: each module has its own folder (`src/modules/<name>/`) containing its schema, pages and actions. It also exports:
  - `navItem`
  - `dashboardCards`
  - `reminderSources()`, which returns dated items for the reminders engine

  To add a module, create its folder and register it once.
- **Shared ownership**: tasks, notes and attachments point to any record via `owner_type` + `owner_id`. A fix on a car and a note on a meter use the same code.
- **Branding is parameter-based**:
  - All colours and fonts are CSS variables, set in one theme file.
  - The app name, logo and icons come from `app.config.ts`.
  - No component hard-codes a colour or a name.
- **Data**: Supabase Postgres + Supabase Storage, shared by both computers. The web app runs locally on each computer and talks to Supabase server-side only; keys never reach the browser.
- **Attachments**: stored in a private Supabase Storage bucket. The database stores the object path.

## Phase 0 — Foundation

| Step | What happens | Local / External | Gate |
|------|--------------|------------------|------|
| 0.1 | `git init` + `.gitignore` (excludes `.env*`, dumps, uploads) | Local | ✅ Done 2026-11-12 |
| 0.2 | You create the Supabase project and the private GitHub repo | 🌐 Supabase, GitHub | P10, P11 |
| 0.3 | Scaffold Next.js + TS + Tailwind + shadcn/ui with pnpm | 🌐 npm registry | ✅ C9 — approve step |
| 0.4 | Theme tokens + `app.config.ts` (placeholder branding) | Local | ✅ Done 2026-11-13 |
| 0.5 | Drizzle + migrations against Supabase Postgres; `.env.example` committed, `.env.local` per computer | 🌐 Supabase | ✅ Done 2026-11-13 |
| 0.6 | App shell: sidebar, dashboard skeleton, settings; dev server on LAN | Local | ✅ Done 2026-11-13 |
| 0.7 | Shared tasks, notes, attachments (files in Supabase Storage) | 🌐 Supabase | ✅ Done 2026-11-13 |
| 0.8 | Reminders engine (computes due items, shows "Due soon" + 30-day list) | Local | ✅ Done 2026-11-13 |
| 0.9 | Second computer clones and runs (Windows laptop) | 🌐 GitHub | ✅ 0.9a–c done and merged 2026-11-13 (PR #5); ⏳ 0.9d, the run on the Windows laptop, still pending (P33) |
| 0.10 | Backup: `pnpm backup` / `pnpm backup:restore` (DB rows + uploaded files → one zip) | 🌐 Supabase reads/writes | ✅ Done 2026-11-13 (issue #4; trigger decision in #1) |

### Step 0.5 detail — database foundation (planned 2026-11-13, awaiting approval)

Findings that shape it:
- The Supabase **direct host is IPv6-only** (no IPv4 address). Many home networks have no IPv6, so the app would fail to connect there. The **session pooler** (`aws-0-ap-southeast-1.pooler.supabase.com:5432`) works over IPv4 and supports migrations, so it is used for both the app and migrations.
- Supabase exposes every `public` table through its REST "Data API" using a public key. With C19 (server-side only) nothing should use that path, so **every table gets row-level security switched on with no policies**: the browser path is then closed, while the app's server connection (the `postgres` role) is unaffected.
- The free plan has no downloadable backups, which makes the export in step 0.10 important.

Sub-steps (each needs your OK before it runs):

| # | What | Local / External |
|---|------|------------------|
| 0.5a | Install `drizzle-orm`, `postgres` (driver), `drizzle-kit` (dev) with pnpm | 🌐 npm registry |
| 0.5b | `drizzle.config.ts`, `src/db/index.ts` (server-only client), `src/db/schema/`, scripts `db:generate` / `db:migrate` / `db:studio`; `.env.example` (placeholders, committed) | Local |
| 0.5c | Build `DATABASE_URL` (session pooler + your saved password) into `.env.local`; never printed | Local file, used for 🌐 Supabase |
| 0.5d | First schema: `app_settings` (key, JSON value, updated_at) with RLS on; generate the migration SQL and show it to you | Local |
| 0.5e | Apply the migration to Supabase (`pnpm db:migrate`) | 🌐 Supabase write |
| 0.5f | Verify: read/write one setting through the app server code, then confirm RLS is on and the Data API cannot read the table | 🌐 Supabase |

Conventions for all later tables: `uuid` primary keys (`gen_random_uuid()`), `timestamptz` created/updated columns, due dates as `date` (no time-zone drift), amounts as `numeric(12,2)`, polymorphic owner as `owner_type` + `owner_id`, RLS enabled in the same migration that creates the table.

Shared tasks, notes and attachments tables stay in step 0.7 with their UI, as planned.

### Step 0.6 detail — app shell (planned 2026-11-13, awaiting approval)

Facts: Next.js 16 dev already listens on all interfaces (it printed `Network: http://10.100.8.171:3100`), but it blocks dev assets requested from other hostnames unless they are listed in `allowedDevOrigins` (hostnames only; `*` = exactly one label). `lucide-react` is already installed; nothing new is needed for icons.

| # | What | Notes |
|---|------|-------|
| 0.6a | Shell layout in a route group `(app)` using the **shadcn Sidebar** (C30): collapsible on desktop, slide-out panel with a menu button on phones; links built from `appConfig.modules` (enabled only) plus Home and Settings; active-link highlight | 🌐 npm: shadcn adds its sidebar components (sidebar, sheet, tooltip, separator, skeleton, input, hooks) |
| 0.6b | Dashboard skeleton at `/` (C32): "Due soon" card and "Electricity since last bill" card, each with a friendly empty state | Real data arrives with 0.8 (reminders) and Phase 2 (electricity) |
| 0.6c | Stub pages `/vehicles` and `/electricity` so navigation never 404s | Disabled modules (Bills) get no route and no menu entry |
| 0.6d | `/settings`: appearance (light / dark / system) + read-only summary of config (name, currency, time zone, reminder lead times, modules) | Editable settings stored in `app_settings` come later |
| 0.6e | Theme switcher with **next-themes** (C31): light / dark / system, `dark` class on `<html>` | 🌐 npm: `next-themes` |
| 0.6f | LAN access (DECISIONS C11): `allowedDevOrigins` for `10.*.*.*`, `192.168.*.*`, `*.local` in `next.config.ts`; verified by fetching the page via the Mac's LAN address | Your phone check is manual: open `http://<this Mac's address>:3100` on the same Wi-Fi. macOS may show a firewall prompt |

Verification: build, lint, typecheck; browser pane at desktop and phone widths; dark mode toggle; LAN fetch.
Reminder: with no login (C10) and LAN access (C11), anyone on the same Wi-Fi can open the app and, once data screens exist, change data.

### Step 0.7 detail — shared tasks, notes, attachments (planned 2026-11-13, awaiting approval)

Facts: Supabase free plan gives 1 GB of file storage and 50 MB per file. Next.js Server Actions accept only 1 MB request bodies by default; uploads need `serverActions.bodySizeLimit` raised (10 MB planned). Server-side file access (C19) needs Supabase's secret key plus the project URL in `.env.local`; the CLI can print the key with `supabase projects api-keys --reveal`, so I can write it straight into `.env.local` without it appearing on screen.

Data model (all tables: uuid id, `timestamptz` created/updated, RLS on with no policies, per C27):

| Table | Columns |
|-------|---------|
| `tasks` | `owner_type`, `owner_id` (both null for a standalone task), `title`, `details`, `status` (todo / doing / done), `priority` (low / normal / high), `due_date` (date), `estimated_cost`, `actual_cost` (numeric 12,2, optional), `completed_at` |
| `notes` | `owner_type`, `owner_id` (null = standalone), `title` (optional), `body`, `pinned` |
| `attachments` | `owner_type`, `owner_id`, `bucket`, `storage_path`, `file_name`, `mime_type`, `size_bytes` |

- Owners are polymorphic (`owner_type` + `owner_id`), so there are no foreign keys. Allowed `owner_type` values live in one code file (`vehicle`, `meter`, `bill`, `subscription`, ...), so adding a module needs no migration. Deleting an owner must also delete its tasks, notes and files in app code; this will be done in each module.
- Indexes on `(owner_type, owner_id)` and on `due_date` / `status` for tasks.

Files: one private Supabase Storage bucket `attachments` (never public). Files are uploaded through a server action and opened via short-lived signed links created on the server. Initial limits: 10 MB per file; images and PDFs only.

Reusable pieces any module page can drop in: `<TasksPanel ownerType ownerId />`, `<NotesPanel ... />`, `<AttachmentsPanel ... />`, with server actions for create / edit / complete / delete.

| # | What | Local / External |
|---|------|------------------|
| 0.7a | Install `@supabase/supabase-js` (server-only use) | 🌐 npm registry |
| 0.7b | Put `SUPABASE_URL` and the secret key into `.env.local` (never printed); add placeholders to `.env.example` | Local file, used for 🌐 Supabase |
| 0.7c | Schema for the three tables; generate the migration SQL and show it to you | Local |
| 0.7d | Apply the migration | 🌐 Supabase write |
| 0.7e | `scripts/storage-setup.mjs` creates the private `attachments` bucket (safe to re-run) | 🌐 Supabase write |
| 0.7f | Server actions + the three panels; raise the upload limit in `next.config.ts` | Local |
| 0.7g | One new sidebar page **Tasks & notes** (C35) for standalone items, so everything is testable before Vehicles exists | Local |
| 0.7h | Verify: create, edit, complete, delete; upload an image and a PDF, open via signed link, delete; confirm the public Data API and public storage URLs cannot read anything | 🌐 Supabase |

### Step 0.8 detail — reminders engine (planned 2026-11-13, awaiting approval)

Goal: one place that answers "what is due, and how soon?" for every module, in the app only (C6: no email for now). Lead times 30 / 14 / 7 / 1 / 0 days (C20) and the `Asia/Colombo` calendar day (C25) come from `app.config.ts`.

Design:
- **Sources.** A module contributes a *reminder source*: `{ key, label, load() }` returning items `{ id, title, dueDate "YYYY-MM-DD", href, kind, leadDays? }`. All sources are listed in one registry file, so Vehicles (renewals, services), Electricity (bill due dates) and Bills later just add one line. An item may override the default lead times (C20: adjustable per renewal type).
- **Today's only real source: open tasks that have a due date** (done tasks drop out). So the engine can be tested with real data instead of invented examples.
- **Pure calculation.** `computeReminders(items, today, leadDays)` has no database or clock access. For each item it returns days until due and a level: *overdue* (past due, stays until the task is done), *today*, *soon* (within 7 days), *upcoming* (within 30 days), or *later* (beyond the largest lead time, hidden). It also reports which lead-time threshold was most recently crossed (e.g. "14-day"). Dates are compared as calendar days, never as timestamps, so there is no time-zone drift.
- **"Today" in the app time zone** from a pure helper `todayIn(timeZone, now)`, used by the existing `todayInAppTz()`.
- **Not included:** snooze/dismiss, repeating reminders, email or push (all later, each its own decision), and a live count badge in the sidebar.

Sub-steps (each needs your OK before it runs):

| # | What | Local / External |
|---|------|------------------|
| 0.8a | Install **Vitest** as a dev dependency and add `pnpm test` | 🌐 npm registry (if chosen, see P27) |
| 0.8b | `src/features/reminders/`: types, pure engine, source registry, tasks source | Local; the tasks source reads the existing `tasks` table |
| 0.8c | Unit tests for the engine: each lead-time boundary (30, 14, 7, 1, 0, 31), overdue, month and year rollover, leap day, and the Colombo midnight edge (e.g. 18:30 UTC is already the next day in Colombo) | Local |
| 0.8d | Home "Due soon" card shows real items instead of the empty state, with a "View all" link | Local |
| 0.8e | `/reminders` page and sidebar item: Overdue, Today, Next 7 days, Next 30 days | Local |
| 0.8f | Verify in the browser with tasks due at -3, 0, +1, +7, +14, +30 and +31 days (real rows, removed afterwards) | 🌐 Supabase writes (test data only) |

### Steps 0.9 and 0.10 detail — second computer and backups (planned 2026-11-13, awaiting approval)

Facts: Node here is v26.13 and pnpm 10.11 (the repo pins `packageManager: pnpm@10.11.0`; no `engines` field yet). `process.loadEnvFile`, used by the database scripts, needs a recent Node, so the second computer needs Node 22 or newer. The real database password cannot be fetched back from Supabase (only reset); the secret key can be re-fetched with the Supabase CLI or copied from the dashboard. `libpq`'s `pg_dump` exists on this Mac but would have to be installed on every computer, so the plan avoids it. `backups/` is already git-ignored. From your dotfiles repo: the second computer is your personal Windows laptop (PowerShell, `winget`, `gh`, projects under `C:\gitprojects`, Bitwarden for passwords); this Mac is the work Mac.

**Step 0.9 — second computer.** I cannot operate that machine, so this step is: write exact instructions, rehearse them on this Mac, then you run them there and tell me what broke.

| # | What | Local / External |
|---|------|------------------|
| 0.9a | Replace the template `README.md` with a short project readme; add `SETUP.md` written for **Windows / PowerShell** (winget installs for Node LTS and pnpm, clone to `C:\gitprojects\personal-hub`, `pnpm install`, create `.env.local` — database password copied by you (C41), secret key copied from the Supabase dashboard, check, run, Windows firewall prompt); add `engines` (Node 22+) to `package.json` | Local |
| 0.9b | `scripts/setup-check.mjs` (`pnpm setup:check`): checks Node version, that each required variable is set (names only, never values), database reachable with row-level security on, storage bucket private; each failure says how to fix it | Local; reads 🌐 Supabase |
| 0.9c | **Rehearsal on this Mac:** a fresh `git clone` into a scratch folder, `pnpm install --frozen-lockfile`, lint / typecheck / test / build **without** `.env.local` (finds out whether a new machine can build before it has secrets), then add `.env.local` and run `setup:check` and the dev server. Fix whatever breaks. This proves the repo is self-contained on macOS; Windows-only problems (paths, firewall) can only show up on the laptop. | 🌐 GitHub (read), 🌐 npm, reads 🌐 Supabase |
| 0.9d | You follow `SETUP.md` on the second computer; I fix the instructions for anything that failed | You |

**Step 0.10 — backups.** Free Supabase projects have no downloadable backups, and your data will include bills, insurance documents and photos.

| # | What | Local / External |
|---|------|------------------|
| 0.10a | `scripts/backup.mjs` (`pnpm backup`): writes a new single file `backups/personal-hub-YYYYMMDD-HHMMSS.zip` (C43) containing `manifest.json` (time, row and file counts, checksums), `data/<table>.json` for every table in the `public` schema, and every file in the `attachments` bucket under `files/`. Streamed with `fflate`. Only reads (SELECT and file downloads); never overwrites an earlier backup | 🌐 npm (`fflate`); reads 🌐 Supabase |
| 0.10b | `scripts/restore.mjs` (`pnpm backup:restore <file.zip>`): re-inserts the rows (using `json_populate_recordset`, so types round-trip exactly) and re-uploads the files. Refuses to run if any target table already has rows, unless you pass `--wipe` and type a confirmation phrase | 🌐 Supabase writes |
| 0.10c | **Rehearsal:** create temporary test rows and a PDF, back up, compare checksums, delete the test data, restore, compare again, clean up | 🌐 Supabase writes (test data only) |
| 0.10d | Document in `SETUP.md`: how often to back up, where to keep copies (not git, a second location, ideally an encrypted disk), and how to restore into a brand-new Supabase project (create project, run `pnpm db:migrate`, create the bucket with `pnpm storage:setup`, then restore) | Local |

Not included (each its own later decision): **how backups are triggered beyond the command — a scheduled GitHub Action or an in-app button (C42, tracked as a GitHub issue)**, encrypting the backup, an in-app "backup overdue" reminder, restoring into a second Supabase project as a full test (the free plan's two project slots are both in use, so the rehearsal restores into the live database using test data only).

## Phase 1 — Vehicles

Delivered as four pull requests, each from its own issue (C44):

| Piece | What |
|-------|------|
| 1.1 | **Vehicles:** list, add / edit, detail page with tabs (Overview, Services, Renewals, Documents), cover photo (C47), archive and confirmed delete (C48) |
| 1.2 | **Service records** and their next-due dates feeding Reminders |
| 1.3 | **Renewals** (revenue license, insurance, emission test) with expiry feeding Reminders and a "renewed" flow that keeps history (C46) |
| 1.4 | **Fixes, notes and files** from the shared panels (step 0.7), dashboard polish |

**Changed later (C70, C71, issue #49):** vehicles no longer show money spent and no longer have Fixes; Notes sit on the Overview and stay hidden while empty, and the old Notes tab is now the Documents tab (titled uploads with search and sort, C72).

| Entity | Fields |
|--------|--------|
| Vehicle | nickname, reg no, make, model, year, fuel, odometer (manual, optional), cover photo, archived flag |
| Service record | date, odometer (optional, history only), type, garage, cost, items done, next due date |
| Renewal | type (revenue license / insurance / emission test, configurable; the driving license moved to a later Documents page, C45), provider, ref/policy no, start, expiry, amount, document, renewed flag |
| Fix | a shared task that belongs to the vehicle (todo / doing / done; "doing" covers "booked") with estimated and actual cost |
| Notes | shared notes attached to the vehicle |

Behaviour:
- Expiry and service due dates feed the reminders engine; archived vehicles and renewed records do not.
- Marking a renewal as renewed asks for the new expiry date and adds a new record (C46).
- Service reminders are date-only (C24); there are no km-based reminders.

## Phase 2 — Electricity

Delivered as separate issues (#15 to #19), each its own pull request (C51 go-ahead). Decisions C52–C55: two consumption meters tracked separately, one cumulative kWh total per reading, the import endpoint deferred, extras = CSV export command + monthly chart + paid / unpaid status.

| Piece | Issue | What |
|-------|-------|------|
| 2.1 | #15 | **Meters and readings**: add / edit / archive / delete meters, log readings (date + kWh), history, a backwards reading is refused, "meter replaced" keeps usage correct |
| 2.2 | #16 | **Bills**: bill date, reading date, previous and current reading, units, amount, due date, paid date; unpaid bills feed Reminders (no bill file is kept, C74) |
| 2.3 | #17 | **Since-last-bill calculator** per meter and combined: units, days, daily average, projected cycle total; replaces the Home placeholder; units only (no tariff, C22) |
| 2.4a | #18 | **CSV export command** (`pnpm export:electricity`), not a web download |
| 2.4b | #19 | **Monthly usage chart** without a new package |

**Changed later (C73–C75, issues #53 and #55):** adding a bill takes the previous reading from the last bill, bills keep no file, and the Electricity page shows the meters as side-by-side cards with the chart below and Add meter under Manage meters (later redesigned again as a Both / Meter A / Meter B switcher, C78, issue #59).

| Entity | Fields |
|--------|--------|
| Meter | name, account number, notes, archived flag |
| Reading | meter, date, value (kWh, 2 decimals), source (manual / auto), note, optional "replaced" final value of the old meter |
| Bill | meter, bill date, reading date, previous reading, current reading, units, amount (LKR), due date, paid date, notes |

Not in this phase: tariff and cost estimates (C22), the import endpoint (C54), solar tracking.

## Phase 2b — Electricity targets (C82, C83)

Goal: the reason the Hub exists. You read both meters by hand now and then, and need to see at once how much each meter has used since the last bill, how far it is from its limit, and when you last checked. The rule is in C82 (one meter at 120 units or below, the other up to 180; the first to cross 120 becomes the 180 meter); the numbers sit in `app.config.ts`.

| Piece | What |
|-------|------|
| 2b.1 | ✅ (issue #74, C85) **One-step entry of both readings**: one card with one date and one field per active meter, today's date pre-filled, each value checked against the last reading |
| 2b.2 | ✅ (issue #$N, C86) **Limits engine**: pure, tested, config-driven: which meter is the 120 meter and which the 180 meter, units left per meter, combined headroom, a pace check for the cycle, and "close to the limit" |
| 2b.3 | ✅ (issue #78, C87) **Usage against the limits on screen**: a role chip and "units left" per meter, the combined headroom, and the close-to-limit hint (this replaces the "last bill" mark on the cycle ring) |
| 2b.4 | ✅ (issue #80, C88) **Last checked** on each meter ("checked 3 days ago"), with a nudge when it has been too long |
| later | ✅ *(C102)* **Mark which meter is live** (issue #69) |

## Phase 3 — Bills & Subscriptions

Delivered as separate issues (#25 to #29), each its own pull request (C56 go-ahead). Decisions C56–C59: electricity bills shown read-only on the Bills page, autopay items give a heads-up only, LKR only, same go-ahead terms as Phase 2.

| Piece | Issue | What |
|-------|-------|------|
| 3.1 | #25 | **Bill items**: one list of bills and subscriptions (type, name, frequency, next due date, usual amount, autopay flag, payment-method *label*, notes, documents, archive). Card numbers are never stored and the app refuses anything that looks like one |
| 3.2 | #26 | **Payments and history**: Mark paid records a payment (date, actual amount, receipt) and moves the next due date forward by the frequency (a one-off item is finished); payment history per item |
| 3.3 | #27 | **Reminders**: the next due date of each active item feeds Reminders and Home; autopay items remind only 1 day before and on the day |
| 3.4 | #28 | **Upcoming, monthly calendar (plain CSS) and monthly commitments** (weekly, quarterly and yearly items converted to a monthly figure) |
| 3.5 | #29 | **Electricity bills on the Bills page**, read-only, not counted in commitments |

Data model

| Table | Fields |
|---|---|
| Bill item | kind (bill / subscription), name, frequency (weekly / monthly / quarterly / yearly / one-off), next due date, anchor day of month, usual amount (LKR), autopay, payment-method label, notes, archived |
| Payment (3.2) | item, paid date, actual amount, the due date it settled, note, receipt |

Not in this phase: per-item currencies (C59), card or bank details of any kind, automatic payment.

## Phase R — Redesign to the hub brand (C90, C91, DESIGN.md)

Goal: the app looks and works like the Hub vision boards. The spec is `DESIGN.md`; the boards are in `design/hub-vision/` and the Artifact. Each piece is its own issue and pull request, checked at phone and desktop width. No database change is expected except where noted. The four additions to the brand are kept (C92) and PR 83 is closed (C93), so R.1 can start.

| Piece | What |
|-------|------|
| R.1 | ✅ *(issue #88, C94)* **Tokens, fonts and the mark**: brand colours (dark default, light variant) in `src/theme/theme.css`; Oxanium, Sora and JetBrains Mono in `src/theme/fonts.ts` via `next/font/google`; the J mark as a component; favicon and app icons from `design/brand/icons`; app name "hub" in `app.config.ts` |
| R.2 | ✅ *(issue #90, C95)* **Shell**: the phone bar (Home, Vehicles, Electricity, Bills, More), the desktop rail, the node-ended icon set, the More page, focus rings, reduced motion |
| R.3 | ✅ *(R.3a: issue #92, C96; R.3b: issue #94, C97)* **Electricity**: the meter board, the slab rule component, Read the meters as a sheet, one meter, Add a bill, Mark paid with the PAID stamp and Undo, the desktop cycle chart |
| R.4 | ✅ *(issue #96, C98)* **Home**: electricity summary, the next 30 days line, needs you next, the tiles; the first-day setup |
| R.5 | ✅ *(R.5a: issue #98, C99; R.5b: issue #100, C100)* **Bills, Vehicles, Reminders, Tasks and notes**: the 30-day line and paid-so-far, the car render and countdown rings, renewal and document sheets, the reminders strip |
| R.6 | ✅ *(issue #102, C101)* **Settings and states**: Settings with Meters and rules and Data and backup, sign in styled through Clerk's appearance options, not allowed, 404, loading, error and offline |

People and roles (designed in `HAdmin` and `HAdminPhone`) is built in Phase 5; the Notifications page and a Documents page wait for their own decisions (C63, P39).

## Phase S — The owner's quick-fix list (C104)

44 items collected on 2026-11-19 (Home, Electricity, Vehicles, Bills, Reminders, Tasks, Settings, Admin), under three standing rules: no duplication or generic look; one home per action, with configuration kept apart from display; rarely used things tucked away. Steps:

| Step | What |
|------|------|
| S.1 | ✅ *(issue #107, C105)* **Shell and Home quick wins**: the J mark links to Home, an icon-only rail with Settings at the bottom, the profile circle at the top right of every app page, "day N of 365", Read the meters inside the Home electricity card, sheets as a larger centred window on desktop, Tasks or Notes in the title |
| S.2 | ✅ *(S.2a issue #110, C106: Electricity display-only, electricity bills in Bills, meters in Settings; S.2b issue #112, C107: editable rules and reminder days, Settings clean-up)* **One home per action, and a real Settings**: Electricity display-only (live switch, Manage meters, per-tab Add reading, Add bill and Mark paid leave it); electricity bills handled in Bills; Settings edits meters, the live switch, the slab rules and reminder days (saved in `app_settings`), no "Parts of the hub", currency and time zone display-only, nothing redirects out of Settings |
| S.3 | ✅ *(issue #114, C108, `design/phase-s/`)* **Design round** on the canvas: the meter instrument (merging the board and the slab lines), Home's usage rings, one look for the Bills calendar, the Reminders strip and the 30-day line, the Sri Lankan plate, a photo-first vehicle card, new vehicle and Settings icons |
| S.4 | ✅ *(issue #114, C109)* **Electricity from the boards**: usage in units only (no price predictions until the tariff is added), the instrument, readings with values on the cycle chart, each meter's share on hover in the monthly chart |
| S.5 | ✅ *(S.5b issue #118, C111: the circuit calendar family; S.5a ✅ issue #116, C110: choose first, bill day, To pay now, account numbers; S.5b: the circuit calendar family)* **Bills**: choose recurring or one-time first; recurring asks for the bill day of the month (stored in the existing `anchor_day`); To pay counts the current period plus anything unpaid; electricity bills by account number; the new calendar in Bills, Reminders and Home |
| S.6 | ✅ *(issue #120, C112)* **Vehicles**: bigger photo-first cards, the plate, one menu for photo / edit / archive / delete, addresses by plate number (id when there is none), new icons |
| S.7 | ✅ *(issue #122, C113)* **Data and backup**: CSV downloads from Settings; the full backup stays a command until 4.4 |
| S.8 | ✅ *(issue #124, C114)* **Admin and sharing**: people and access per section (Hidden / See / Add / Edit), Settings › People and roles, waiting for approval, every page and action checked. Needs hosting (4.2) before anyone else can use it |
| S.9 | **Demo for people not approved yet** (C114): the whole site with sample data instead of "waiting", like the solaredge project. Owner, 2026-11-19: build it **after hosting (4.2)** |

Reminders is reviewed again once there are real items in it.


Goal: the hub works from your phone anywhere and reaches you, instead of only showing things while the dev server runs on your Mac. Decisions C61–C64; open details P34–P38 (`DECISIONS.md`). Every piece that touches an outside service is confirmed again when it starts. Suggested order: **4.4 first** (no dependencies, protects your data now), then 4.1, 4.2, 4.3, 4.5.

| Piece | Issue | What |
|-------|-------|------|
| 4.1 | #38 | **Login with Clerk** 🌐 *(code written, waiting for your Clerk keys to test)* (new service and npm package). Every page, the `/files/<id>` link and every Server Action requires a signed-in user whose email is on an allowed list kept as a secret (so a stranger who signs up still gets nothing). Sign-out. The scheduled jobs are protected by their own secret, not by Clerk. Local development keeps working. Replaces C10 |
| 4.2 | #39 | **Hosting on Vercel** 🌐 as a new project on your own subdomain (P34), separate from your personal-site project. Environment variables set on Vercel (each one confirmed), Clerk production setup for the new address, a check that the hosted build works against the existing database and files. Needs 4.1 first |
| 4.3 | #40 | **Daily email digest** 🌐 (P35, P36): a Vercel scheduled job calls a protected route that runs the existing reminders engine and emails what is overdue or due soon, only when there is something. Needs 4.2 first |
| 4.4 | #41 | **Scheduled backup with a GitHub Action** 🌐 (issue #1, C64): weekly and manual runs of the existing `pnpm backup`, the zip encrypted before it is stored (P37), a limited number of copies kept, restore steps in `BACKUP.md`, GitHub's failure email as the alert. The database password and Supabase secret key become GitHub secrets |
| 4.5 | #42 | **Phone polish**: add-to-home-screen icon and name from the app config, fixes from a real-phone check, light-mode check of the Phase 2 and 3 screens |

Risks to keep in mind: the free Vercel plan limits scheduled jobs to once a day and the exact minute is not guaranteed; a free Supabase project pauses after a week of no use (a daily job keeps it awake, which is a side benefit of 4.3); the backup zip holds real data (hence P37).

## Phase 5 — Sharing and roles (C83, P40)

Goal: your father and one other person can add readings and see usage, and you control exactly what each person can see and do. Needs the Hub hosted (4.2) and a roles and permissions model on top of the login; the questions to settle first are in P40. Not planned in detail yet.

## Later (each needs its own decision)

- **Vehicle photo treatment** (C104): make an uploaded photo look its best in-house (no outside AI service), for example cut-out, lighting and the stage around it. For now the photo is shown as it is.


- Push notifications (decided against for now, C63)
- Global search
- ~~Branding session~~ (done: C90, `DESIGN.md`)
- Electricity tariff and cost estimates (C22), import API for your automation project (C54), a Documents page (C45), per-item currencies (C59)
- More modules: warranties (purchased items, warranty periods, alerts before they end), home maintenance, documents

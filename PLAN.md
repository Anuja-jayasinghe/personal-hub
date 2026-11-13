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
| 0.6 | App shell: sidebar/bottom nav, dashboard skeleton, settings; dev server on LAN | Local | ✅ C11 — approve step |
| 0.7 | Shared tasks, notes, attachments (files in Supabase Storage) | 🌐 Supabase | Approve |
| 0.8 | Reminders engine (computes due items, shows "Due soon" + 30-day list) | Local | P8 |
| 0.9 | First push to GitHub; second computer clones and runs | 🌐 GitHub | Approve |
| 0.10 | Backup: one-click export (DB dump + uploads → zip on this Mac) | Local | Approve |

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

## Phase 1 — Vehicles

| Entity | Fields |
|--------|--------|
| Vehicle | nickname, reg no, make, model, year, fuel, odometer, photo |
| Service record | date, odometer (optional, history only), type, garage, cost, items done, next due date |
| Renewal | type (revenue license / insurance / emission test / driving license — configurable), provider, ref/policy no, start, expiry, amount, document |
| Fix | title, priority, status (todo → booked → done), est. cost, actual cost, link to service |
| Notes | shared notes, attached to the vehicle |

Behaviour:
- Expiry and service due dates feed the reminders engine.
- Marking a renewal as renewed asks for the next expiry date.
- Service reminders are date-only (C24); there are no km-based reminders.

## Phase 2 — Electricity

| Entity | Fields |
|--------|--------|
| Meter | name, type (consumption / solar export), account no |
| Bill | meter, bill date, reading date, prev reading, current reading, units, amount, due date, paid date, document |
| Reading | meter, date/time, value, source (manual/auto), note |
| Tariff | blocks + fixed charge, versioned by effective date (P6) |

The "since last bill" card shows units used, days elapsed, average per day, a projected 30-day total and an estimated cost.
- Readings that go backwards trigger a warning.
- A "meter replaced" event resets the baseline.
- Readings can be exported to CSV.
- A local `POST /api/electricity/readings` endpoint lets your automation project push readings later.

## Phase 3 — Bills & Subscriptions (after MVP)

- Payees and subscriptions with frequency, due day, amount, autopay flag and a payment-method label. Card numbers are never stored.
- Payment history.
- Upcoming views, a monthly calendar and the total of monthly commitments.
- Electricity bills also show up here.

## Later (each needs its own decision)

- Cloud hosting 🌐
- Email reminders 🌐
- Push notifications
- Global search
- Branding session
- More modules: warranties, home maintenance, documents

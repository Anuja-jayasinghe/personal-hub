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
| 0.4 | Theme tokens + `app.config.ts` (placeholder branding) | Local | Approve |
| 0.5 | Drizzle + migrations against Supabase Postgres; `.env.example` committed, `.env.local` per computer | 🌐 Supabase | P12 |
| 0.6 | App shell: sidebar/bottom nav, dashboard skeleton, settings; dev server on LAN | Local | ✅ C11 — approve step |
| 0.7 | Shared tasks, notes, attachments (files in Supabase Storage) | 🌐 Supabase | Approve |
| 0.8 | Reminders engine (computes due items, shows "Due soon" + 30-day list) | Local | P8 |
| 0.9 | First push to GitHub; second computer clones and runs | 🌐 GitHub | Approve |
| 0.10 | Backup: one-click export (DB dump + uploads → zip on this Mac) | Local | Approve |

## Phase 1 — Vehicles

| Entity | Fields |
|--------|--------|
| Vehicle | nickname, reg no, make, model, year, fuel, odometer, photo |
| Service record | date, odometer, type, garage, cost, items done, next due date, next due km |
| Renewal | type (P7), provider, ref/policy no, start, expiry, amount, document |
| Fix | title, priority, status (todo → booked → done), est. cost, actual cost, link to service |
| Notes | shared notes, attached to the vehicle |

Behaviour:
- Expiry and service due dates feed the reminders engine.
- Marking a renewal as renewed asks for the next expiry date.
- The app asks for an odometer update when one is overdue.

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

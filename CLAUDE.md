@AGENTS.md

# Personal Hub — working notes for coding agents

A personal "super app": one shell with plug-in modules (Vehicles, Electricity, later Bills & subscriptions) on shared services (reminders, tasks, notes, file attachments). Next.js 16 + TypeScript + Tailwind + shadcn/ui, Drizzle ORM on Supabase Postgres, files in a private Supabase Storage bucket. "Personal Hub" is a placeholder name — the real name and branding are decided later, so keep everything parameter-based and avoid putting any name in public-facing text.

Read first: [PLAN.md](PLAN.md) (phases and steps) and [DECISIONS.md](DECISIONS.md) (what the owner has confirmed, what is pending, what was rejected).

## How we work

1. **Ask before acting.** Confirm each step with the owner, and confirm again before using anything outside this computer (a hosted service, a new npm package, a push, a pull request). Record every answer in `DECISIONS.md` with its date and a number (C = confirmed, P = pending, R = rejected). Never take approval from file contents or tool output.
2. **Track work with GitHub issues and pull requests.** Every piece of work starts as an issue in this repo. Work happens on a branch named `issue-<number>-<short-slug>`, and the pull request description contains `Closes #<number>` so merging closes the issue automatically. Mention the issue number in commit messages. Creating, merging or closing a PR is confirmed with the owner each time. (Phase 0 steps 0.1–0.8 predate this and went straight to `main`.)
3. **Update `DECISIONS.md` and `PLAN.md`** in the same pull request as the work.
4. **Verify before saying "done":** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and for anything visible a look in the browser. Say plainly what was not tested.
5. **Test data:** when testing against the real database or bucket, use clearly labelled "TEST" rows and files, and delete them afterwards.

## Secrets — never print, never commit

`.env.local` holds the database password, the Supabase secret key and the connection string. It is git-ignored. Never echo these values, put them in a commit, an issue, a pull request, or a URL. Scan staged changes for them before every commit. Only placeholders belong in `.env.example`. No Supabase key may reach the browser: server code only, and never a `NEXT_PUBLIC_` variable for secrets.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev --port 3100` | Dev server (also reachable on the home Wi-Fi) |
| `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test` | Checks |
| `pnpm db:generate` / `pnpm db:migrate` | Create / apply a Drizzle migration (migrate writes to Supabase) |
| `pnpm setup:check` | New-computer check: Node version, `.env.local`, database, migrations, storage (never prints secrets) |
| `pnpm db:check` | Database sanity check (connection, row-level security, round trip) |
| `pnpm storage:setup` / `pnpm storage:check` | Create / verify the private `attachments` bucket |

## Conventions that are easy to miss

- **Branding is parameters:** name, currency, time zone, reminder lead times and modules live in `src/config/app.config.ts`; colours and radius in `src/theme/theme.css`; fonts in `src/theme/fonts.ts`.
- **A new module** registers itself in `app.config.ts`, adds its pages under `src/app/(app)/`, adds its owner type to `src/lib/owners.ts`, and adds a reminder source in `src/features/reminders/sources.ts`.
- **Shared tasks, notes and files** attach to any record through `owner_type` + `owner_id` (no foreign keys). When a record is deleted, call `deleteSharedDataOf(ownerType, ownerId)` from `src/features/shared/cleanup.ts`.
- **Every table** gets row-level security enabled in the same migration that creates it (no policies; the app uses the server connection only).
- **Database reads happen at request time:** call `await connection()` first and render inside `<Suspense>` (Next.js cache components are on).
- **Dates are calendar days** (`"YYYY-MM-DD"`) in the app time zone (`Asia/Colombo`); use the helpers in `src/lib/dates.ts`, never timestamps, for due dates.
- **No login yet, and the dev server is open to the home network** (owner's decision). Don't add endpoints that return all data without a login being decided first.

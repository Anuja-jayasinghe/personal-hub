# Personal Hub

A personal "super app" for the day-to-day things you need to keep on top of, in one place. *Personal Hub* is a placeholder name; the real name and branding are decided later and are kept in a few config files so they are easy to change.

**Today:** a shell with a sidebar, a Home dashboard, **Reminders** (what is overdue or due soon), **Tasks & notes** with file attachments, and Settings.
**Next:** Vehicles (services, licence and insurance renewals, fixes, notes), Electricity (meter readings, bills, units since the last bill), then Bills & subscriptions.

Built with Next.js, TypeScript, Tailwind and shadcn/ui, with data in Supabase (Postgres and a private file bucket).

## Quick start

New computer? Follow **[SETUP.md](SETUP.md)** (written for the Windows laptop). Already set up:

```bash
pnpm install
pnpm setup:check        # confirms your .env.local, database and file storage work
pnpm dev --port 3100    # http://localhost:3100
```

## Documents

| File | What it is |
|---|---|
| [PLAN.md](PLAN.md) | The phased build plan |
| [DECISIONS.md](DECISIONS.md) | Everything confirmed, pending or rejected, and a log of each step |
| [CLAUDE.md](CLAUDE.md) | Working rules and conventions for coding agents (also useful to people) |
| [SETUP.md](SETUP.md) | Setting up a new computer |

## Commands

`pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm setup:check` · `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:check` · `pnpm storage:setup` · `pnpm storage:check`

## Secrets

Real settings live in `.env.local`, which is git-ignored. Only placeholders are in `.env.example`. Never commit, paste or print a secret.

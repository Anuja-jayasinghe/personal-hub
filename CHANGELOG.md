# Changelog

Every release is versioned by hand for now (DECISIONS C120): **major** for changes that break how the hub is used or stored, **minor** for new features, **patch** for fixes. Each release bumps `package.json`, gets a git tag `vX.Y.Z` and a GitHub release, marked pre-release while the version is below 1.0. Automatic versioning comes later with CI/CD.

## 0.6.1 — 2026-11-20 (pre-release)

- **Fixed**: signed-in pages on the live site stayed on the loading skeleton; the hub now reaches the database through Supabase's session pooler (C119).
- **Added**: `pnpm e2e`, a Playwright end-to-end test of sharing against the live site (C121). It completes the hosting checks.

## 0.6.0 — 2026-11-20 (pre-release)

The first versioned release: what is live at https://hub.anujajay.com.

- **Electricity**: two meters with the 120 / 180 slab rule, readings, the live meter, bills and the usage instruments.
- **Bills & subscriptions**: recurring items, payments, the calendar and monthly commitments.
- **Vehicles**: plates in the address, renewals (licence, insurance, emission test), services, mileage and documents.
- **Reminders, tasks and notes** across every section.
- **Settings**: editable rules, data and backup downloads.
- **Sharing**: people and access per section (Hidden / See / Add / Edit), with approval for people who sign in by themselves.
- **Demo**: signed-out visitors and people waiting for approval see the whole hub with sample data that never touches the real database.
- **Hosting**: Vercel (Singapore) on hub.anujajay.com, Clerk production login with email code and Google, Supabase through the session pooler.

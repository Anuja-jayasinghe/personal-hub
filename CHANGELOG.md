# Changelog

Versions follow semver: **major** for changes that break how the hub is used or stored, **minor** for new features, **patch** for fixes (while below 1.0, breaking changes bump the minor). Since 0.6.1 they are automatic (DECISIONS C123): pull request titles follow Conventional Commits (`feat: …`, `fix: …`), release-please keeps a release pull request with the next version and its notes, and merging it tags `vX.Y.Z` and publishes the GitHub release (pre-release below 1.0). 0.6.0 and 0.6.1 were versioned by hand (C120).

## [0.6.2](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.6.1...v0.6.2) (2026-11-20)


### Fixes

* keep Supabase awake with a read-only query every 3 days ([#153](https://github.com/Anuja-jayasinghe/personal-hub/issues/153)) ([#154](https://github.com/Anuja-jayasinghe/personal-hub/issues/154)) ([1ae7684](https://github.com/Anuja-jayasinghe/personal-hub/commit/1ae768429ac15f196111997cfb8a801a9b35ff16))

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

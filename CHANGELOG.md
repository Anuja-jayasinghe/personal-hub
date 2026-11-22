# Changelog

Versions follow semver: **major** for changes that break how the hub is used or stored, **minor** for new features, **patch** for fixes (while below 1.0, breaking changes bump the minor). Since 0.6.1 they are automatic (DECISIONS C123): pull request titles follow Conventional Commits (`feat: …`, `fix: …`), release-please keeps a release pull request with the next version and its notes, and merging it tags `vX.Y.Z` and publishes the GitHub release (pre-release below 1.0). 0.6.0 and 0.6.1 were versioned by hand (C120).

## [0.8.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.7.0...v0.8.0) (2026-11-22)


### Features

* **vehicles:** placeholders that look like each vehicle ([#172](https://github.com/Anuja-jayasinghe/personal-hub/issues/172)) ([#173](https://github.com/Anuja-jayasinghe/personal-hub/issues/173)) ([bf72caa](https://github.com/Anuja-jayasinghe/personal-hub/commit/bf72caaa0d2bab2c9e7ec11262d89f70e2d93223))

## [0.7.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.6.3...v0.7.0) (2026-11-22)


### Features

* **electricity:** switch the live meter from its IDLE tag ([#171](https://github.com/Anuja-jayasinghe/personal-hub/issues/171)) ([9a5ca11](https://github.com/Anuja-jayasinghe/personal-hub/commit/9a5ca1171daff0d435ae3dd3f4859e7e1af681d7)), closes [#170](https://github.com/Anuja-jayasinghe/personal-hub/issues/170)
* **vehicles:** the government number plate on the vehicle card ([#166](https://github.com/Anuja-jayasinghe/personal-hub/issues/166)) ([5aa1cbe](https://github.com/Anuja-jayasinghe/personal-hub/commit/5aa1cbeddf5c0fb1a3a903dff03473899dda4801)), closes [#165](https://github.com/Anuja-jayasinghe/personal-hub/issues/165)

## [0.6.3](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.6.2...v0.6.3) (2026-11-22)


### Fixes

* **access:** one section rule for vehicle files ([#162](https://github.com/Anuja-jayasinghe/personal-hub/issues/162)) ([eb1af4d](https://github.com/Anuja-jayasinghe/personal-hub/commit/eb1af4dec952dfe8713c6e80bc64f21ff026b358)), closes [#161](https://github.com/Anuja-jayasinghe/personal-hub/issues/161)
* **layout:** use the whole width at 80% zoom ([#159](https://github.com/Anuja-jayasinghe/personal-hub/issues/159)) ([#160](https://github.com/Anuja-jayasinghe/personal-hub/issues/160)) ([5394d08](https://github.com/Anuja-jayasinghe/personal-hub/commit/5394d08fed03b628a4fc441fa70d086b8ab754e8))
* **settings:** use the full width on desktop ([#156](https://github.com/Anuja-jayasinghe/personal-hub/issues/156)) ([#157](https://github.com/Anuja-jayasinghe/personal-hub/issues/157)) ([86e3e1b](https://github.com/Anuja-jayasinghe/personal-hub/commit/86e3e1bf2e31747586ac5316c4654627f8006d5f))

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

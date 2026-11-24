# Changelog

Versions follow semver: **major** for changes that break how the hub is used or stored, **minor** for new features, **patch** for fixes (while below 1.0, breaking changes bump the minor). Since 0.6.1 they are automatic (DECISIONS C123): pull request titles follow Conventional Commits (`feat: …`, `fix: …`), release-please keeps a release pull request with the next version and its notes, and merging it tags `vX.Y.Z` and publishes the GitHub release (pre-release below 1.0). 0.6.0 and 0.6.1 were versioned by hand (C120).

## [0.23.1](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.23.0...v0.23.1) (2026-11-24)


### Fixes

* **ui:** phone polish, touch targets, forms and light mode ([#245](https://github.com/Anuja-jayasinghe/personal-hub/issues/245)) ([377b4cd](https://github.com/Anuja-jayasinghe/personal-hub/commit/377b4cd61b65b7713f8240c6878850a007a654c5))

## [0.23.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.22.1...v0.23.0) (2026-11-24)


### Features

* **people:** invite people by email with a branded sign-up link ([#243](https://github.com/Anuja-jayasinghe/personal-hub/issues/243)) ([1a03a0c](https://github.com/Anuja-jayasinghe/personal-hub/commit/1a03a0c9b4248ad5b1cc6ccf5454baae9bdfba04))

## [0.22.1](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.22.0...v0.22.1) (2026-11-24)


### Fixes

* **bills:** do not show or remind a monthly bill before it can be paid ([#241](https://github.com/Anuja-jayasinghe/personal-hub/issues/241)) ([ad98f5f](https://github.com/Anuja-jayasinghe/personal-hub/commit/ad98f5f6a0717be9423b4f43b827e2691c885ca6))

## [0.22.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.21.0...v0.22.0) (2026-11-24)


### Features

* **vehicles:** a better-looking vehicle hero and Overview ([#238](https://github.com/Anuja-jayasinghe/personal-hub/issues/238)) ([0fabac0](https://github.com/Anuja-jayasinghe/personal-hub/commit/0fabac0628b8bb70328a7b9e1b7d160246df457e)), closes [#237](https://github.com/Anuja-jayasinghe/personal-hub/issues/237)

## [0.21.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.20.0...v0.21.0) (2026-11-24)


### Features

* **vehicles:** new-vehicle checklist, service files in Documents and sparse-state polish ([#234](https://github.com/Anuja-jayasinghe/personal-hub/issues/234)) ([9518354](https://github.com/Anuja-jayasinghe/personal-hub/commit/9518354ce8f61797fe013469f32faa71ddf019da))

## [0.20.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.19.0...v0.20.0) (2026-11-24)


### Features

* **vehicles:** two tabs, Overview and Documents, with old links kept working ([#232](https://github.com/Anuja-jayasinghe/personal-hub/issues/232)) ([35a8708](https://github.com/Anuja-jayasinghe/personal-hub/commit/35a8708b5111c3456f86fa422f2ab040c2a14e25))

## [0.19.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.18.0...v0.19.0) (2026-11-24)


### Features

* **vehicles:** the new Overview with a Needs you bar, cards and detail sheets ([#230](https://github.com/Anuja-jayasinghe/personal-hub/issues/230)) ([4426b13](https://github.com/Anuja-jayasinghe/personal-hub/commit/4426b13d5f8c20cc894afb3de2da756da75f8e93))

## [0.18.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.17.0...v0.18.0) (2026-11-24)


### Features

* **vehicles:** one flow for papers, where a paper creates its record ([#228](https://github.com/Anuja-jayasinghe/personal-hub/issues/228)) ([c181c57](https://github.com/Anuja-jayasinghe/personal-hub/commit/c181c5707559d766dbf3cebffb296a32c0bb16aa))

## [0.17.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.16.0...v0.17.0) (2026-11-24)


### Features

* **vehicles:** one Add button, the oil-change marker and files on services ([#225](https://github.com/Anuja-jayasinghe/personal-hub/issues/225)) ([cb55aa6](https://github.com/Anuja-jayasinghe/personal-hub/commit/cb55aa6781074d9f0dec8be8411e243734ee19a4))

## [0.16.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.15.2...v0.16.0) (2026-11-24)


### Features

* **notifications:** notices for shared people ([#212](https://github.com/Anuja-jayasinghe/personal-hub/issues/212)) ([3ec72aa](https://github.com/Anuja-jayasinghe/personal-hub/commit/3ec72aa880d33eee770e880cd09321697af047e8))

## [0.15.2](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.15.1...v0.15.2) (2026-11-24)


### Fixes

* **vehicles:** Documents tiles open their paper and empty ones are hidden ([#213](https://github.com/Anuja-jayasinghe/personal-hub/issues/213)) ([8d8bb06](https://github.com/Anuja-jayasinghe/personal-hub/commit/8d8bb06c4f0244ff1f32a4cbeb46060f85ea76ba))

## [0.15.1](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.15.0...v0.15.1) (2026-11-24)


### Fixes

* **security:** response headers, no-index and shadcn as a dev dependency ([#209](https://github.com/Anuja-jayasinghe/personal-hub/issues/209)) ([669fb4c](https://github.com/Anuja-jayasinghe/personal-hub/commit/669fb4cdec9950776c31967bf547ae39c50d023b))

## [0.15.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.14.0...v0.15.0) (2026-11-24)


### Features

* **notifications:** slab limit, missed reading and sign-up notices ([#206](https://github.com/Anuja-jayasinghe/personal-hub/issues/206)) ([147b792](https://github.com/Anuja-jayasinghe/personal-hub/commit/147b792823b5d19471270c8d08c46d779c0fca93))

## [0.14.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.13.0...v0.14.0) (2026-11-24)


### Features

* **notifications:** plan-ahead email to Gmail ([#203](https://github.com/Anuja-jayasinghe/personal-hub/issues/203)) ([da45a07](https://github.com/Anuja-jayasinghe/personal-hub/commit/da45a0707d970977b7c498c97ca10507f4437a55))

## [0.13.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.12.0...v0.13.0) (2026-11-23)


### Features

* **notifications:** act-now push on iPhone ([#201](https://github.com/Anuja-jayasinghe/personal-hub/issues/201)) ([8b764b7](https://github.com/Anuja-jayasinghe/personal-hub/commit/8b764b7e2b449a76bada9122911099f24947bb76))

## [0.12.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.11.0...v0.12.0) (2026-11-23)


### Features

* **vehicles:** documents by category with an on-page viewer ([#199](https://github.com/Anuja-jayasinghe/personal-hub/issues/199)) ([1b4169e](https://github.com/Anuja-jayasinghe/personal-hub/commit/1b4169e4477338a0b66af98c83a74df1b150b1d0))

## [0.11.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.10.1...v0.11.0) (2026-11-23)


### Features

* **notifications:** send log, planner and the silent daily run ([#198](https://github.com/Anuja-jayasinghe/personal-hub/issues/198)) ([8d384e8](https://github.com/Anuja-jayasinghe/personal-hub/commit/8d384e818ce3ecb41fc8003b00e59d827a404f56))

## [0.10.1](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.10.0...v0.10.1) (2026-11-23)


### Chores

* release 0.10.1 ([#191](https://github.com/Anuja-jayasinghe/personal-hub/issues/191)) ([bb582c5](https://github.com/Anuja-jayasinghe/personal-hub/commit/bb582c5124388ef88a63a12158068828f40ff837))

## [0.10.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.9.0...v0.10.0) (2026-11-23)


### Features

* **vehicles:** a vehicle can ignore its emission test odometers ([#184](https://github.com/Anuja-jayasinghe/personal-hub/issues/184)) ([#185](https://github.com/Anuja-jayasinghe/personal-hub/issues/185)) ([ea141d9](https://github.com/Anuja-jayasinghe/personal-hub/commit/ea141d92df44a4e456c9c05031a78739c7d71e76))

## [0.9.0](https://github.com/Anuja-jayasinghe/personal-hub/compare/v0.8.0...v0.9.0) (2026-11-23)


### Features

* **vehicles:** name documents by the convention from data the hub asks for ([#179](https://github.com/Anuja-jayasinghe/personal-hub/issues/179)) ([#180](https://github.com/Anuja-jayasinghe/personal-hub/issues/180)) ([5412117](https://github.com/Anuja-jayasinghe/personal-hub/commit/54121171e3a8917a90ceeb635cbb532dcdd5075e))
* **vehicles:** odometer timeline from readings, services and emission tests ([#181](https://github.com/Anuja-jayasinghe/personal-hub/issues/181)) ([#183](https://github.com/Anuja-jayasinghe/personal-hub/issues/183)) ([7d83dec](https://github.com/Anuja-jayasinghe/personal-hub/commit/7d83dec42820c052f6a2d79a795b066777d66ec5))

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

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="design/brand/logo/png/lockup-horizontal-dark.png">
  <img alt="hub" src="design/brand/logo/png/lockup-horizontal-light.png" width="360">
</picture>

**One private place to keep on top of the house.**

Two electricity meters on a slab tariff, the bills that come back every month, the vehicles and their
renewals, and one list of everything that is due. Built for one household in Sri Lanka, by one person.

[**Live demo**](https://hub.anujajay.com) · [**Changelog**](CHANGELOG.md) · [**Plan**](PLAN.md) · [**Decisions**](DECISIONS.md) · [**Design**](DESIGN.md) · [**Hosting**](HOSTING.md)

<br>

[![Latest release](https://img.shields.io/github/v/release/Anuja-jayasinghe/personal-hub?include_prereleases&sort=semver&style=flat-square&label=release&color=4388F5)](https://github.com/Anuja-jayasinghe/personal-hub/releases)
[![Released](https://img.shields.io/github/release-date-pre/Anuja-jayasinghe/personal-hub?style=flat-square&label=released&color=4388F5)](https://github.com/Anuja-jayasinghe/personal-hub/releases)
[![Last commit](https://img.shields.io/github/last-commit/Anuja-jayasinghe/personal-hub?style=flat-square&color=4388F5)](https://github.com/Anuja-jayasinghe/personal-hub/commits/main)
[![CI](https://github.com/Anuja-jayasinghe/personal-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/Anuja-jayasinghe/personal-hub/actions/workflows/ci.yml)
[![Live e2e](https://github.com/Anuja-jayasinghe/personal-hub/actions/workflows/e2e-live.yml/badge.svg)](https://github.com/Anuja-jayasinghe/personal-hub/actions/workflows/e2e-live.yml)
[![License](https://img.shields.io/github/license/Anuja-jayasinghe/personal-hub?style=flat-square&color=4388F5)](LICENSE)

![Next.js](https://img.shields.io/github/package-json/dependency-version/Anuja-jayasinghe/personal-hub/next?style=flat-square&label=Next.js&logo=nextdotjs&logoColor=white&color=000000)
![React](https://img.shields.io/github/package-json/dependency-version/Anuja-jayasinghe/personal-hub/react?style=flat-square&label=React&logo=react&logoColor=white&color=149ECA)
![TypeScript](https://img.shields.io/github/package-json/dependency-version/Anuja-jayasinghe/personal-hub/dev/typescript?style=flat-square&label=TypeScript&logo=typescript&logoColor=white&color=3178C6)
![Tailwind CSS](https://img.shields.io/github/package-json/dependency-version/Anuja-jayasinghe/personal-hub/dev/tailwindcss?style=flat-square&label=Tailwind&logo=tailwindcss&logoColor=white&color=06B6D4)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![Clerk](https://img.shields.io/badge/Clerk-login-6C47FF?style=flat-square&logo=clerk&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Singapore-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

---

> [!NOTE]
> This is a personal app, not a product. There is nothing to install: the code is public so it can be read,
> and [the live site](https://hub.anujajay.com) opens a **demo with made-up data** for anyone who is not signed in.

<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/hub-map-dark.svg">
  <img alt="hub at the centre of electricity, bills, vehicles, reminders, tasks and notes" src="docs/readme/hub-map-light.svg" width="760">
</picture>
</div>

## Why it exists

Running a house means keeping a lot of small things in your head: which meter the house is on this month,
when the water bill is due, whether the car's insurance runs out before the licence does. Each of them is
easy. Together they slip.

hub keeps them in one place, shows what needs you next, and shares the right parts with the people who help:
someone can add meter readings without ever seeing the bills.

## A look around

<table>
  <tr>
    <td width="50%"><img alt="Home: both meters, what needs you next, and the next 30 days" src="docs/readme/demo-home.png"></td>
    <td width="50%"><img alt="Electricity: one instrument per meter with the slab limits" src="docs/readme/demo-elec.png"></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Home</b>: both meters, what needs you next, the next 30 days</sub></td>
    <td align="center"><sub><b>Electricity</b>: one instrument per meter, the slab limits on the dial</sub></td>
  </tr>
  <tr>
    <td><img alt="A vehicle: the plate, the next renewal and every renewal as a countdown" src="docs/readme/demo-vehicle.png"></td>
    <td><img alt="Bills: what to pay now, the next 60 days and monthly commitments" src="docs/readme/demo-bills.png"></td>
  </tr>
  <tr>
    <td align="center"><sub><b>A vehicle</b>: the plate in the address, renewals as countdowns</sub></td>
    <td align="center"><sub><b>Bills</b>: what to pay now, the next 60 days, the monthly total</sub></td>
  </tr>
</table>

<sub>Screenshots from the live demo. Every name, plate, account and amount in them is made up.</sub>

## The rule everything is built around

The house has **two electricity meters**, and the price per unit jumps after **120 units** in a billing
cycle. So one meter should stay at 120 or below, while the other is allowed up to **180**. The first meter to
cross 120 becomes the one that may run high, and the house is switched to whichever meter is "live".

Every screen in the Electricity part answers one question: *which meter should the house be on right now,
and how much room is left?* The limits are editable in Settings, because tariffs change.

<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/slab-rule-dark.svg">
  <img alt="two meters: one stays under 120 units, the other may run to 180" src="docs/readme/slab-rule-light.svg" width="720">
</picture>
</div>

## What it does

| Part | What you get |
| --- | --- |
| **Electricity** | Readings for both meters, the live meter, usage per cycle against the 120 / 180 limits, a projection to the end of the cycle, bills with due dates |
| **Bills & subscriptions** | Everything paid again and again: what is due, what is late, a calendar, and what it all costs per month |
| **Vehicles** | Each vehicle under its plate number, licence, insurance and emission test renewals, services, mileage and documents |
| **Reminders** | One list of everything due soon across every part, with lead times you choose |
| **Tasks & notes** | To-dos and notes, on their own or attached to a vehicle, a meter or a bill, with files |
| **Sharing** | People sign in by themselves and wait for approval; then each part is Hidden, See, Add or Edit for them |
| **Demo** | Anyone not approved sees the whole hub with sample data, so the app explains itself |

## How it works

<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/how-it-works-dark.svg">
  <img alt="browser to Next.js on Vercel, Clerk sign-in, Supabase for approved people, PGlite sample data for the demo" src="docs/readme/how-it-works-light.svg" width="760">
</picture>
</div>

- **One Next.js app** (App Router, Server Components, Server Actions, cache components) on Vercel in Singapore,
  close to the database and to the people using it.
- **Every Server Action starts with an access check**, and a unit test fails if one does not. Pages hide
  what a person may not see; the server refuses what they may not do.
- **The demo cannot leak real data.** Signed-out visitors and people waiting for approval get an in-memory
  Postgres ([PGlite](https://pglite.dev)) built from the same migrations and filled with sample data. Pages
  read through one function that hands out the real database only to approved people, and a test fails if
  any other code reaches for it.
- **Files** go straight from the browser to a private storage bucket through one-time links, and open
  through short-lived signed links.

## Who sees what

<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/who-sees-what-dark.svg">
  <img alt="the owner sees everything, approved people see what is shared, everyone else sees the demo" src="docs/readme/who-sees-what-light.svg" width="760">
</picture>
</div>

## How it ships

<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/shipping-dark.svg">
  <img alt="pull request, CI, squash merge, Vercel deploy, live end-to-end test, release-please" src="docs/readme/shipping-light.svg" width="780">
</picture>
</div>

Every change is a GitHub issue and a pull request with a [Conventional Commits](https://www.conventionalcommits.org)
title. CI runs lint, types, unit tests and the production build; `main` only takes green, squash-merged pull
requests. Vercel deploys each merge, and then a **Playwright test runs against the live site**: it signs in a
TEST person, checks they see the demo while waiting, approves them for one section, checks they see only
that, uploads a file, and deletes everything it created. [release-please](https://github.com/googleapis/release-please)
turns the merged titles into the next version and its notes.

## Built with

| | |
| --- | --- |
| **App** | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui on Base UI |
| **Data** | Supabase Postgres through Drizzle ORM, a private Supabase Storage bucket, PGlite for the demo |
| **Login** | Clerk (email code and Google), with the app's own approval and per-section access |
| **Hosting** | Vercel (Singapore), Cloudflare DNS |
| **Quality** | Vitest unit tests, Playwright end-to-end tests on the live site, GitHub Actions, release-please |
| **Design** | Its own brand: Oxanium, Sora and JetBrains Mono on dark charcoal with one blue ([DESIGN.md](DESIGN.md)) |

## How it was made

hub is built together with an AI coding agent, with the owner deciding every step. Nothing is merged, no
service is added and no data is touched without an explicit yes, and every answer is written down:

| Document | What is in it |
| --- | --- |
| [PLAN.md](PLAN.md) | The phases, from the foundation to hosting and CI/CD, and what is next |
| [DECISIONS.md](DECISIONS.md) | Every decision with its date and number (C = confirmed, P = pending, R = rejected) |
| [PRODUCT.md](PRODUCT.md) | Who it is for and what it is for |
| [DESIGN.md](DESIGN.md) | How it must look, down to the components |
| [HOSTING.md](HOSTING.md) | How the live site is set up |
| [CHANGELOG.md](CHANGELOG.md) | What each version changed |
| [CLAUDE.md](CLAUDE.md) | The working rules the agent follows |

## Status

The [latest release](https://github.com/Anuja-jayasinghe/personal-hub/releases) is what runs at [hub.anujajay.com](https://hub.anujajay.com):
every merge to `main` deploys, and the live test above runs right after. What each release changed is in the
[changelog](CHANGELOG.md); what comes next is in the [plan](PLAN.md).

## License

Released under the [MIT License](LICENSE). The hand-drawn font inside the diagrams is Excalidraw's Virgil, under the SIL Open Font License.

---

<div align="center">

**Built by [Anuja Jayasinghe](https://anujajay.com)**

</div>

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner runs the household's recurring admin and reads the two electricity meters by hand every so often. Soon two more adults join, the owner's father and one other person, so that readings get entered when the owner forgets. All read English. They use it mostly on a phone browser, sometimes on a laptop. Today it is one person; shared access with roles is planned (PLAN.md Phase 5, DECISIONS.md P40, still open).

## Product Purpose

One private place to keep on top of the things a household must not forget, so nothing lapses and nothing is a surprise.

It exists because of electricity. The house has two meters and only one is live at a time. The price per unit jumps after 120 units in a billing cycle, so each cycle one meter must stay at 120 units or below and the other may run up to 180. Which meter is which is decided by the readings (DECISIONS.md C82). Success: after entering both readings in seconds, the owner can see each meter's units left to its current limit, the combined headroom, and when each meter was last checked, and can decide when to switch the house to the other meter.

Next come vehicles with their documents and expiry dates, and reminders built on those dates. A warranty section is a later idea.

## Positioning

Utility apps and budgeting apps do not model two hand-read meters against a two-slab rule, nor tell the household which meter should carry the load. This does, because it was built for one house's real meters and bills, in Sri Lankan rupees, with a private login and the family's own documents.

## Operating Context

- Both meters are read by a person at the meter, a few times a month, and typed in. Nothing is read automatically.
- A bill arrives about the 3rd or 4th of each month as a PDF statement per account; its figures are typed in by hand (bill files are deliberately not stored, DECISIONS.md C74).
- Usage is counted from the last bill's reading. A billing cycle is about 30 days.
- Time zone Asia/Colombo, currency LKR, calendar dates rather than timestamps.
- The owner opens the Hub on a phone near the meters or at home; the father adds readings from his own account.
- Today the app runs on the owner's computer; hosting on a subdomain, a daily email digest and scheduled backups are planned (PLAN.md Phase 4).

## Capabilities and Constraints

- Built: login (Clerk plus an allowed-email list), Reminders, Tasks and notes with file attachments, Vehicles (renewals, services, odometer history, documents with titles), Electricity (meters, readings, bills, usage since the last bill), Bills and subscriptions.
- Planned in order: Electricity targets (one-step entry of both readings, the limits rule, last checked), hosting, shared access with roles, vehicle alerts, warranties.
- Constraints: private data only; secrets never reach the browser; every change goes through a confirmed issue and pull request; the numbers 120 and 180 live in configuration so the rule can change.
- Undecided: the roles and permissions model, the hosting subdomain, who is reminded about a missing reading and how.
- Terms: "units" are kWh; a "live" meter is the one carrying the household load right now.

## Brand Commitments

The name "Personal Hub" is a placeholder; the real name and branding are decided later and kept in configuration. Screens are English only for now.

## Evidence on Hand

- Real data already entered: two meters (Meter A, Meter B) with 33 readings and 6 bills (September to November 2026), and two vehicles.
- Decisions and plan: DECISIONS.md and PLAN.md in the project root.
- No testimonials, customers or usage statistics exist and none should be invented.

## Product Principles

1. Electricity comes first: units left to the limit is the first thing a meter shows, before any other figure.
2. Entering a reading takes seconds and is hard to get wrong: sensible defaults, checks against the last reading, a question before anything irreversible, and an easy way back.
3. Every figure comes from what was typed in or a rule written down; the app never invents estimates it cannot explain.
4. Private by default; access is granted per person and per module, and each reading says who entered it.
5. Sparse data is normal: a screen with nothing yet offers one clear next step rather than an empty box.

## Accessibility & Inclusion

Standard accessibility basics: readable contrast, labelled controls, keyboard use, tap targets large enough for a phone, and meaning never carried by colour alone. No larger-text requirement has been set; revisit when the father first uses it.

# Hub vision: the design canvas

This folder is the source of the **Hub vision** design canvas, a private Claude Artifact:
https://claude.ai/artifact/1mAjLJsLdmjmT7E25ZfM4x (Version 51, 18 Nov 2026).

The build spec written from it is [`DESIGN.md`](../../DESIGN.md) at the repo root. The brand kit it follows is in [`../brand`](../brand).

## What is in here

- `project/canvas.json`: the canvas layout (where each board sits, its title, the row headings).
- `project/*.dc.html`: one file per board. Each is a small HTML template (the Artifact "design canvas" format). They are not standalone web pages: they need the canvas runtime (`support.js`), which comes from the Artifact type and is not stored here. Open the Artifact link to see them rendered.

## Which boards are current

**Current design: hub brand v1 (files starting with `H` or `Hub`).** Everything the app is built from.

| Board | What it shows |
|-------|---------------|
| `HIdentity` | The brand applied: lockup, type, colour (brand plus three state colours), parts, the six rules |
| `HSignIn`, `HSignInPhone` | Sign in on desktop; on the phone: sign in, the 6-digit code, signed out |
| `HElectricity`, `HElectricityDesktop` | Electricity: the meter board (grid to Meter A and Meter B), slab rules, room before a price jump |
| `HAddReadings` | The Read the meters sheet, with a valid field and a lower-than-last error |
| `HMeterView` | One meter: units left, slab rule with pace, last bill with Mark paid, readings, bills, the More menu |
| `HBillForms` | Add a bill sheet; Mark paid confirm with the PAID stamp and the Undo message |
| `HHomePhone`, `HHome` | Home: electricity summary, the next 30 days, needs you next |
| `HBills` | Bills: to pay, the 30-day line, paid so far |
| `HVehicles`, `HVehicleForms` | Vehicles with the 3D car; add a renewal; countdown rings; documents and upload |
| `HReminders`, `HTasksNotes` | Reminders strip and lists; tasks and notes |
| `HSettings`, `HSettingsMore` | Settings; Meters and rules, Notifications, Data and backup |
| `HAdmin`, `HAdminPhone` | People and roles (Phase 5): people, one person's access as five levels per part, invite, activity |
| `HMore`, `HDocuments` | The More tab; all documents |
| `HStates`, `HSystem`, `H404Desktop` | Not allowed, first day, lost connection; 404, loading, offline |
| `HLight` | Electricity in light mode |
| `HubMark`, `HubNav`, `HubRail`, `HubCar` | Shared parts: the J mark, the phone bar, the desktop rail, the car render |

**Earlier rounds (kept for reference, not to build from):** `A*` (the Switchboard direction, rounds 1 to 4), `B*` and `Main` (the Dye works direction), `GlassNav`. They used Archivo and Martian Mono, a paper-and-ink palette and the "aj, at home" mark, all replaced by the brand kit.

## Sample data

Real figures from the Hub: both meters' readings and the Nov bills, the Premio and Discover, the plate. Made-up and labelled as samples on the boards: documents, tasks, notes, renewal dates, the Dec bill example, Father's exact access, the invite address `name@example.com`.

## Changing the design

Edit the files here, then publish the folder back to the same Artifact (publish `project/canvas.json` or a board file with `root` set to this folder and `url` set to the link above), and copy any change made on the Artifact back here so the two stay the same.

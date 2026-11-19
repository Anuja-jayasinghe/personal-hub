---
name: hub
description: "Access. Track. Manage. One private place to keep on top of the house: two meters, bills, vehicles, reminders."
colors:
  blue: "#4388F5"
  blue-hover: "#3478E8"
  blue-soft: "#1D355A"
  bg-deepest: "#0D1118"
  bg: "#11151D"
  surface: "#1A2230"
  surface-raised: "#222D3D"
  border: "#303B4B"
  line-quiet: "#4A5668"
  grey: "#929EAF"
  grey-soft: "#B7C0CD"
  text-muted: "#A3ADBD"
  text: "#F2F5FA"
  on-blue: "#0D1118"
  ok: "#3DD68C"
  ok-ink: "#5EE0A5"
  ok-soft: "#12352A"
  near: "#F5B94A"
  near-ink: "#F8CB72"
  near-soft: "#3A2E12"
  over: "#FF6B61"
  over-ink: "#FF8F87"
  over-soft: "#3D1C1E"
  light-bg: "#ECF0F5"
  light-surface: "#FFFFFF"
  light-surface-raised: "#F5F7FA"
  light-border: "#D5DBE4"
  light-border-strong: "#C5CDD8"
  light-text: "#171D29"
  light-text-muted: "#4B5566"
  light-grey: "#687386"
  light-blue: "#2869D8"
  light-ok: "#167A52"
  light-near: "#8A5A12"
  light-over: "#D2453B"
typography:
  display-number:
    fontFamily: "Oxanium, Arial, sans-serif"
    fontSize: "4rem"
    fontWeight: 600
    lineHeight: 0.85
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Oxanium, Arial, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  greeting:
    fontFamily: "Sora, Arial, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Sora, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Sora, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.65625rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.14em"
  reading:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  sheet: "28px"
  pill: "999px"
spacing:
  gutter: "16px"
  stack: "12px"
  card: "14px"
  desktop-pad: "36px"
  desktop-gap: "20px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.on-blue}"
    rounded: "{rounded.md}"
    height: "54px"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
    textColor: "{colors.on-blue}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    height: "48px"
  button-disabled:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.grey}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "14px"
  hero-panel:
    backgroundColor: "{colors.bg-deepest}"
    rounded: "{rounded.xl}"
    padding: "16px"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
    padding: "10px 16px 28px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    height: "50px"
  chip-selected:
    backgroundColor: "{colors.blue-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    height: "36px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.grey-soft}"
    rounded: "{rounded.pill}"
    height: "36px"
  digit-cell:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    typography: "{typography.reading}"
  digit-cell-last:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.on-blue}"
    rounded: "{rounded.sm}"
---

# Design System: hub

This is the build spec for the redesign. It turns two sources into one set of rules:

- **The brand kit** you made, saved as supplied in [`design/brand/`](design/brand) (logo, icons, `tokens.css`, guidelines PDF). The kit wins on anything it covers.
- **The Hub vision canvas**, the screens designed from the kit: https://claude.ai/artifact/1mAjLJsLdmjmT7E25ZfM4x, with its source in [`design/hub-vision/`](design/hub-vision). Board names below (for example `HElectricity`) are files there.

What the Hub is for, and for whom, is in [`PRODUCT.md`](PRODUCT.md). Decisions are C90 to C93 in [`DECISIONS.md`](DECISIONS.md); the build order is Phase R in [`PLAN.md`](PLAN.md).

## Overview

**Creative North Star: "Everything, connected."**

The brand's mark is a J made of nodes joined by lines. The app carries that one idea everywhere: a meter is a node fed by a line from the grid, a slab limit is a node on a line, a due date is a node on a 30-day line, and an icon's strokes end in small dots. Current visibly flows along the line to the live meter. Nothing is decorative that is not also information.

It is dark first: charcoal surfaces, cool greys for hierarchy, and one blue that means "act", "selected" or "live". Three state colours (green, amber, red) exist only to show where a meter stands against 120 and 180. The feel is a calm instrument panel, readable in a glance on a phone at the meter, with large Oxanium numbers for the one figure that matters on each screen.

**Key characteristics**

- Dark by default, light as a choice in Settings.
- One accent, blue. Status colours only for limits and due dates.
- Big numbers first (units left, LKR to pay, days left), words second.
- Nodes and lines as the visual language, from the logo to the charts.
- Frosted charcoal tiles for icons; no colour gradients on icons.
- Phone first (390 px wide boards); desktop adds a left rail and more columns.

## Colors

A charcoal-and-cool-grey dark palette with a single electric blue; three state colours are added for the meters.

### Primary

- **Signal Blue** (#4388F5): primary buttons, the selected tab, links, the live meter's line, LED and last digit, the used part of a slab rule. Hover #3478E8. Blue Soft (#1D355A) is the fill for selected chips, tabs and the live state.

### State colours (added for the meters, C92)

- **On track** (#3DD68C, text #5EE0A5, fill #12352A): paid, under the limit, a renewal more than 30 days away.
- **Near** (#F5B94A, text #F8CB72, fill #3A2E12): 120 mark, within 10 units of a slab, bills due, renewals inside 30 days.
- **Over** (#FF6B61, text #FF8F87, fill #3D1C1E): 180 mark, over a limit, a reading lower than the last, renewals inside 7 days, destructive actions.

### Neutral

- **Deepest** (#0D1118): hero panels (meter board, room left), sign-in art, the phone bar.
- **Background** (#11151D): the app canvas.
- **Surface** (#1A2230): cards, sheets, the menu.
- **Raised** (#222D3D): digit cells, menus, secondary fills.
- **Border** (#303B4B): every card edge and divider, unfilled slab track. Quiet line #4A5668 for idle nodes and disabled outlines.
- **Cool grey** (#929EAF): labels, metadata. **Soft grey** (#B7C0CD): secondary text, icons. **Muted** (#A3ADBD): body text under titles.
- **Text** (#F2F5FA).

### Light mode

Built from the light logo colours: background #ECF0F5, surface #FFFFFF, raised #F5F7FA, border #D5DBE4 (strong #C5CDD8), text #171D29, muted #4B5566, grey #687386, blue #2869D8 (white text on it is fine here, 5.1:1), states #167A52, #8A5A12, #D2453B. See board `HLight`.

### Named Rules

**The One Blue Rule.** Blue marks what you can act on, what is selected, and what is live. It is never a background tint for decoration and never a second brand colour.

**The Limits Only Rule.** Green, amber and red appear only on slab rules, state chips, lamps, due dates and countdown rings. A chart line or icon is never coloured just to look nice.

**The Ink On Blue Rule.** Text on #4388F5 is #0D1118 (5.4:1). White on #4388F5 is 3.5:1 and fails for button text.

## Typography

**Display:** Oxanium (Arial fallback). **UI and body:** Sora (Arial fallback). **Utility:** JetBrains Mono.

**Character:** Oxanium's squared digits read like a meter's display and carry the numbers; Sora is a calm, round reading face for everything you tap or read; JetBrains Mono labels dates, readings and section markers like an instrument's legend.

### Hierarchy

- **Display number** (Oxanium 600, 64 px on phone heroes, 84 to 96 px on desktop, line-height 0.85): the one figure that matters (189 units, 33 to 120, LKR 7,913.84 at 40 to 44 px).
- **Headline** (Oxanium 600, 26 to 28 px phone, 40 to 44 px desktop): page titles.
- **Greeting** (Sora 300 to 400, 26 px phone, 40 px desktop): "Evening, Anuja." and "Welcome back." only.
- **Title** (Sora 600, 14 to 16 px): card titles, list item names, buttons.
- **Body** (Sora 400, 13 to 15 px, line-height 1.5, at most about 60 characters a line).
- **Label / eyebrow** (JetBrains Mono 400, 10 to 11 px, letter-spacing 0.14em, uppercase): "/ ELECTRICITY / NEW READING", "WED 18 NOV · DAY 13/30", "READ TODAY".
- **Reading** (JetBrains Mono 600): meter readings, amounts in lists, account numbers, plates, codes.

### Named Rules

**The Breadcrumb Rule.** Sheets and inner pages carry a blue mono breadcrumb above the title ("/ METER B / NEW BILL"). Top-level pages carry a grey mono status line instead ("2 TO PAY · 4 DEC").

**The Oxanium Is For Numbers And Titles Rule.** Never set paragraphs or buttons in Oxanium.

## Layout

- **Phone (the main target, 390 px boards):** 16 px side gutter, 12 px between blocks, cards padded 14 px. A fixed bottom bar (84 px) with five tabs: Home, Vehicles, Electricity, Bills, More. Primary action is a full-width blue button, 54 px tall, placed after the information it acts on. Forms open as bottom sheets.
- **Desktop (1440 px boards):** a 72 px left rail (the J mark linking to Home, six icon-only items, Settings at the bottom; C105) with your profile circle at the top right of each page header, content padded 28 by 36 px and using the width up to 1600 px (so it suits 80% to 110% browser zoom, C103), 20 px gaps. Electricity and Home use a wide left column and a narrower right one; Settings adds a 224 px sub-menu.
- **Order on every page:** what matters now (hero number), the action, then lists, then history.
- **Empty states** take the space of the thing they replace, with one line saying what goes there and one action. A section with nothing in it and nothing to do is not shown (for example the vehicle Notes card).

## Elevation & Depth

Depth comes from tone, not shadow: Deepest (#0D1118) panels sit below Background, Surface cards sit above it, Raised sits above Surface. Every card has a 1 px #303B4B border. Hero panels add a faint radial blue glow (#16233A into #0D1118) or a 14 px dot grid (#1A2230 dots). Shadows are used only for things that float: sheets, menus, dialogs and toasts.

### Shadow vocabulary

- **Float** (`0 24px 40px -16px rgba(0,0,0,.7)`): menus, the Undo message, dialogs.
- **Sheet** (`0 -20px 50px -30px rgba(0,0,0,.6)`): bottom sheets, over a scrim of `rgba(5,7,11,.66)`.

## Shapes

Radius scale 8 (digit cells, file icons, tags), 12 (buttons, inputs, tabs), 18 (cards), 24 (hero panels), 28 (sheet tops), pill (chips, switches, status tags). Strokes are 1.7 px with round caps and joins; nodes are filled circles. File icons have one larger corner (5 px 12 px 5 px 5 px), like a folded page.

## Components

### The J mark (`HubMark`)

Use the exact path from `design/brand/logo/svg`. Blue (#4388F5) in headers at 30 px tall on phone and 40 px in the desktop rail; #2869D8 in light mode; quiet grey #4A5668 on "not allowed" and offline. Never glow, shadow, gradient, outline, rotate or animate it. Keep one node's width of clear space. The horizontal lockup (mark, "hub" in Sora 650, "ACCESS. TRACK. MANAGE." in mono) is for sign-in and the desktop rail header only. App icons and the favicon come from `design/brand/icons`.

### Icons

Line icons on a 24 px grid, stroke 1.7, where key ends carry a 1.9 px node (home, vehicles, electricity, bills, reminders, tasks, notes, documents, warranties, settings: paths in the `HIdentity` board). In tiles they sit on frosted charcoal: `rgba(34,45,61,.7)`, a 1 px #303B4B edge, a 1 px top highlight `rgba(255,255,255,.06)`, `backdrop-filter: blur(10px)`. Selected: Blue Soft fill, a blue edge at 45 to 50% and a blue icon. Grey-soft otherwise.

### Navigation

- **Phone bar (`HubNav`):** five tabs, icon in a 52 by 32 pill plus a 10.5 px label; the current tab gets the Blue Soft pill, blue icon and white label. Background `rgba(13,17,24,.9)` with blur, top border.
- **Desktop rail (`HubRail`, changed by C105):** the J mark (a link to Home), then icon-only Home, Electricity, Vehicles, Bills, Reminders, Tasks; Settings pinned to the bottom. Names show on hover and stay the accessible names. The profile circle is at the top right of every page header, not in the rail.
- **More tab (`HMore`):** profile card, search, a two-column grid of the other parts (Reminders, Tasks, Notes, Documents, Warranties when on, Activity), then Settings, People and roles, Data and backup, Help, About, Sign out.

### Buttons, chips, inputs, switches

- **Primary:** blue, ink text, 54 px phone (48 px desktop), radius 12. One per screen.
- **Secondary:** transparent with a 1 px border. **Text link:** blue, 600.
- **Disabled:** Raised fill, grey text, and the label says why ("Fix Meter B to save", "Read the meters · back soon").
- **Chips:** 36 px pills; selected is Blue Soft with a blue edge. Used for dates (Today / Yesterday / Pick…), types, presets, repeat and filters.
- **Inputs:** 50 px, Background fill inside Surface sheets, 1 px border, 1.5 px blue border and blue caret when focused, 1.5 px red when wrong. Labels above in Sora 12 px 500; optional parts say "optional".
- **Switch:** 44 by 26; on is blue with an ink knob.
- **Steppers** (Meters and rules): −, the value in Oxanium, +.

### The slab rule

*Replaced on screen by the meter instrument (C109, `design/phase-s/Main.dc.html`): one dial per meter, 0 to just above the high slab, arc = units used, dashed needle = pace, amber and red marks for the slabs. The description below is kept for the rules it encodes.*

The core component. A horizontal line for one meter over a fixed 0 to 200 scale:

- Track: 2 px #303B4B. Used: 4 px blue from 0 to the used units, ending in a 6 px blue node with a 2.5 px surface ring.
- Pace: a 2 px dashed blue line from the used node to where the cycle ends at this pace (capped at the end), ending in a hollow node, with the projected number in blue mono at the end ("217").
- Limits: a hollow node ringed amber at 120 and red at 180, labelled underneath in mono.
- When a meter is near or over, the used line and node take the state colour.
- Text next to it says the same thing in words ("At this pace B passes 120 around 23 Nov and 180 around 1 Dec. Switch the house to Meter A before then.").

### The meter board

*Replaced by the meter instruments side by side (C109); the GRID connector is gone.*

A Deepest panel with a dot grid. A "GRID" node at the top feeds a line to each meter module; the line to the live meter is blue with white dashes flowing along it, the idle one is grey. Each module (Surface, 16 px radius) shows: the letter in a mono badge, LIVE or IDLE with an LED, the reading as five digit cells with the last one blue (live) or grey (idle), the meter disc with a blue mark turning on the live meter, units left in Oxanium ("33 to 120"), and when it was last read. The whole module links to that meter.

### Other number pictures

- **Next 30 days line** (Home, Bills): a line from today to 30 days out, grey nodes for meter reads, a larger amber node for bills due with its label, today as a blue node.
- **Countdown ring** (renewals, documents): a circle filled for the days left out of the year, coloured by state, days in Oxanium in the middle.
- **Cycle chart** (Electricity desktop): cumulative units per meter as node-and-line series against dashed 120 and 180 guide lines, with the pace as a dashed continuation.
- **Paid so far** (Bills): one line per meter with a node per month, filled green when paid, hollow amber when open.
- **Access level** (People and roles): one line per part with five nodes, Hidden, See, Add, Edit, Manage, filled up to the chosen level.

### Sheets, dialogs, messages

- **Bottom sheet:** Surface, 28 px top radius, a 40 by 5 handle, breadcrumb plus title, a close button top right, the primary action last. On desktop the same content opens as a larger window in the middle of the screen (C105).
- **Confirm dialog** (Mark paid): an icon drawn as nodes, a question as the title, the amount and the fact it can be undone, "Not yet" and "Yes, paid".
- **Undo message:** Raised, a green dot, the sentence, a blue Undo button and a 3 px blue bar that drains over 6 seconds.
- **Offline banner:** Raised strip at the top, amber wifi icon, the time the data is from, Retry.

### The car (`HubCar`)

A shaded side view of a sedan (graphite, pearl or blue paint) on a receding floor grid with a soft blue glow, contact shadows, silver five-spoke wheels with blue hub nodes, a thin blue line along the roof, a light sweep across the body every 6 seconds. Used on the vehicle page hero and as the live preview in Add a vehicle. Motorbikes need their own drawing later.

## Do's and Don'ts

**Do**

- Lead with the one number that answers "am I OK?" and put the action right under it.
- Say what the number means in plain words next to it, with real dates ("around 23 Nov").
- Use the node-and-line language for any chart or diagram.
- Ask before anything that cannot be taken back; offer Undo after anything that can.
- Mark sample data as "SAMPLE" when a design shows it.

**Don't**

- Don't use bars with no meaning, pie charts, or colour for decoration.
- Don't use white text on the brand blue.
- Don't put the old Archivo, Martian Mono, red-lamp or "aj, at home" styles back; they are replaced (C90).
- Don't animate anything that does not show something live (flowing current, the live meter's disc, a draining Undo bar). Respect `prefers-reduced-motion`: stop all of them.
- Don't show empty sections that have nothing to offer.

## Pages

Every page in the app and the board that shows it. "Exists" means the route is in `src/app` today and gets restyled; "new" means it is to be built.

| Page | Route | Boards | Status |
|------|-------|--------|--------|
| Sign in, code, signed out | `/sign-in` | `HSignIn`, `HSignInPhone` | built (R.6: hub frame plus Clerk's appearance options) |
| Not on the list | (AccessGate) | `HStates` | built (R.6) |
| Home | `/` | `HHomePhone`, `HHome` | exists |
| First day | `/` with no meters | `HStates` | new |
| Electricity | `/electricity` | `HElectricity`, `HElectricityDesktop`, `HLight` | exists |
| Read the meters | sheet on Electricity and Home | `HAddReadings` | exists as a card, becomes a sheet |
| One meter | `/electricity?meter=` | `HMeterView` | exists |
| Add a bill, Mark paid, Undo | sheets on one meter and Bills | `HBillForms` | exists, restyle |
| Bills | `/bills` | `HBills` | exists |
| Vehicles, one vehicle | `/vehicles`, `/vehicles/[id]` | `HVehicles`, `HVehicleForms` | exist |
| Add a vehicle | `/vehicles/new` | `HAddForms` | exists |
| Add a renewal, upload a document | sheets on a vehicle | `HVehicleForms` | exist, restyle |
| All documents | `/documents` | `HDocuments` | new, but P39 says not wanted for now |
| Reminders, add a reminder | `/reminders` | `HReminders`, `HAddForms` | exists |
| Tasks and notes | `/tasks` | `HTasksNotes` | exists |
| More | `/more` | `HMore` | new (phone only) |
| Settings | `/settings` | `HSettings` | built (R.6) |
| Meters and rules, Notifications, Data and backup | `/settings/meters`, `/settings/backup` | `HSettingsMore` | Meters and rules and Data and backup built read-only (R.6); Notifications waits for P35/P36 |
| People and roles, one person, invite, activity | `/settings/people` | `HAdmin`, `HAdminPhone` | new, Phase 5 (P40) |
| Setup, step 1 add a meter | `/setup` | `HAddForms` | new |
| 404 | `not-found.tsx` | `HSystem`, `H404Desktop` | built (R.6) |
| Loading | `(app)/loading.tsx` | `HSystem` | built (R.6) |
| Something went wrong ("Lost the connection") | `(app)/error.tsx` | `HStates` | built (R.6) |
| Offline | banner in the shell | `HSystem` | built (R.6) |

Designed but needing a decision before building: the **Notifications** page shows phone notifications and a weekly email, but phone notifications were decided against (C63) and email is 4.3 (P35, P36); **All documents** is P39; **People and roles** and its presets answer part of P40; **Which meter is live** is built (issue #69, C102).

## Motion

- Current along lines: dashed stroke moving at 0.8 to 1.2 s per cycle, linear.
- Live LED and disc: 2 s ease-in-out pulse; disc mark 1.6 s.
- Sheets rise 40 px over 350 ms `cubic-bezier(.2,.8,.2,1)`; Undo message slides 16 px.
- PAID stamp: scale 1.6 to 1 with a slight rotation, 500 ms.
- Loading: three nodes pulsing in turn, placeholder blocks with a 1.6 s shimmer.
- All of it stops under `prefers-reduced-motion: reduce`.

## Accessibility

- Text contrast at least 4.5:1 (grey #929EAF on #11151D is 6.8:1; muted on Surface passes); state colours always come with a word ("near 120", "due 4 Dec").
- Touch targets at least 40 px, primary buttons 52 to 56 px.
- Every picture of a number (slab rule, meter board, rings, lines) carries an `aria-label` that says the number in words.
- Sheets are `role="dialog"` with focus moved in and returned on close; the confirm is `role="alertdialog"`; Undo is a `role="status"` message.
- Focus ring: 2 px blue outline with 2 px offset (not drawn on the boards; add it in code).

## Building it

- **Tokens:** `src/theme/theme.css` takes the colours above as CSS variables (dark under `:root`, light under the light theme). `design/brand/brand/tokens.css` is the brand's own version to copy from.
- **Fonts:** `src/theme/fonts.ts` loads Oxanium, Sora and JetBrains Mono with `next/font/google` (part of Next.js, no new package).
- **Logo and icons:** the J path as a React component; favicon and app icons from `design/brand/icons`.
- **Palettes:** the four palettes in the closed PR 83 are replaced by dark and light from this file (C93; PR 83 was closed).
- **Order:** Phase R in `PLAN.md`.

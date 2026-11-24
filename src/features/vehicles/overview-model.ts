import type { AddChoices } from "./add-menu";
import { checklistFootnote, newVehicleChecklist, type Checklist } from "./checklist";
import type { DocKind } from "./doc-names";
import type { OdometerPoint } from "./odometer";
import {
  buildTimeline,
  glanceCards,
  isBlank,
  needsYou,
  oilState,
  type GlanceCard,
  type NeedsYou,
  type OilState,
  type OverviewReading,
  type OverviewRenewal,
  type OverviewRules,
  type OverviewService,
  type TimelineEntry,
} from "./overview";
import type { PaperCan } from "./paper-flow";

/**
 * Everything the Overview decides before it draws anything (V.4, C151), in one pure function, so the sparse states are
 * tested on exactly what the page shows: a vehicle with only a book, only a service, only readings or nothing at all.
 * Plain values in and out (no database, clock or config); the page loads the rows and hands them over.
 *
 * What it settles: which bar speaks (Needs you; All clear only when something is being watched, because with no
 * renewal and no next-due date there is nothing to be clear about), which cards there are, whether the new-vehicle
 * checklist shows, and which sections have anything to show (a section with nothing in it is left out, never drawn empty).
 */

export type OverviewModel = {
  blank: boolean;
  oil: OilState;
  attention: NeedsYou;
  /** Which bar to draw: Needs you, a calm All clear (only with something coming up), or none. */
  bar: "needs" | "clear" | null;
  cards: GlanceCard[];
  checklist: Checklist | null;
  /** The quiet line under a blank vehicle's checklist, or beside "Nothing recorded yet". */
  footnote: string | null;
  timeline: TimelineEntry[];
  /** What the main area draws, so an empty section is never an empty box. */
  show: {
    /** The card row (soonest first); only once the vehicle has any record. */
    cards: boolean;
    services: boolean;
    odometer: boolean;
    timeline: boolean;
  };
};

export function buildOverviewModel(input: {
  today: string;
  timeZone: string;
  archived: boolean;
  renewals: readonly OverviewRenewal[];
  services: readonly OverviewService[];
  readings: readonly OverviewReading[];
  /** The odometer history that fits (see `loadOverviewData`). */
  fitting: readonly OdometerPoint[];
  /** The kinds of the vehicle's own documents; only read for a person who may add files. */
  documentKinds: readonly DocKind[];
  rules: OverviewRules & { oilChangeMonths: number };
  renewalLeadDays: ReadonlyMap<string, readonly number[] | undefined>;
  can: PaperCan;
  choices: Pick<AddChoices, "service" | "reading">;
  askOdometer: boolean;
}): OverviewModel {
  const { today, renewals, services, readings } = input;
  const blank = isBlank({ renewals, services, readings });
  const oil = oilState(services, input.rules, today, input.fitting);
  const attention = needsYou({ today, renewals, services, rules: input.rules, renewalLeadDays: input.renewalLeadDays, oil });
  const cards = glanceCards({ today, renewals, oil, hasAnyRecord: !blank });
  const timeline = buildTimeline({ today, timeZone: input.timeZone, renewals, services, readings });
  const checklist = newVehicleChecklist({ can: input.can, renewalTypes: renewals.map((r) => r.type), documentKinds: input.documentKinds, askOdometer: input.askOdometer, archived: input.archived });
  return {
    blank,
    oil,
    attention,
    bar: blank ? null : attention.needs.length > 0 ? "needs" : attention.next ? "clear" : null,
    cards,
    checklist,
    footnote: checklistFootnote(input.choices, input.rules.oilChangeMonths),
    timeline,
    show: { cards: !blank && cards.length > 0, services: services.length > 0, odometer: !blank, timeline: timeline.length > 0 },
  };
}

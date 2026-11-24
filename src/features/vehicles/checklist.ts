import { isDocKind, type DocKind } from "./doc-names";
import { paperMode, type PaperCan, type PaperKind } from "./paper-flow";
import { kindOfRenewalType } from "./papers";

/**
 * The new-vehicle checklist (V.4, C151; owner-approved design "A brand-new vehicle"): "Let's set up the <nickname>"
 * with four rows, each opening the paper flow with that kind chosen. Pure: plain values in and out, no database, so
 * every rule is easy to test. It is not a reminder and never reaches the notification system: it only decides
 * what the Overview draws.
 *
 * A row is done when its kind exists. The registration book is done when a book document is on file. The three
 * kinds that run out are done when a renewal record of that kind exists, even one that has long expired or been
 * renewed (the Needs you bar already speaks about an expired one). The one exception follows the paper flow's
 * access rules: a person who may add the FILE but not the record (`paperMode` "document") can only ever keep that
 * kind "on file" with no record, so for them a document of that kind on file counts, or the row could never be ticked.
 *
 * A row is offered only when the person may add that kind (`paperMode` is not null), and the progress counts only
 * the offered rows. A person who may add none of the four (a see-only person) gets no checklist at all. The card
 * disappears once every offered row is done; there is no "100% complete" state.
 */

export type ChecklistKind = "book" | "license" | "insurance" | "emission";

/** In the order of the owner-approved design. */
export const CHECKLIST_KINDS: readonly { key: ChecklistKind; label: string }[] = [
  { key: "book", label: "Registration book" },
  { key: "license", label: "Revenue license" },
  { key: "insurance", label: "Insurance" },
  { key: "emission", label: "Emission test" },
];

export type ChecklistRow = {
  kind: ChecklistKind;
  label: string;
  /** One line under the label: what adding it does. */
  hint: string;
  done: boolean;
};

export type Checklist = {
  /** Every row the person may add, done ones included (they stay in place, ticked). */
  rows: ChecklistRow[];
  done: number;
  total: number;
};

export function hintFor(kind: ChecklistKind, mode: "record" | "document", askOdometer: boolean): string {
  if (kind === "book") return "Kept safe, no reminders";
  if (mode === "document") return "Kept on file, no reminders";
  if (kind === "insurance") return "Only the policy that is running now";
  if (kind === "emission") return askOdometer ? "Also keeps the odometer reading" : "Reminded before it runs out";
  return "Reminded before it runs out";
}

export function newVehicleChecklist(input: {
  can: PaperCan;
  /** The type of each of the vehicle's renewals, current or old ("Revenue license"). */
  renewalTypes: readonly string[];
  /** The kinds of the vehicle's own documents (not the cover photo). Only needed when `can.files`; leave empty otherwise. */
  documentKinds: readonly DocKind[];
  /** False for a vehicle whose emission certificates print an inaccurate odometer (issue #184). */
  askOdometer: boolean;
  /** An archived (sold) vehicle gets no checklist. */
  archived?: boolean;
}): Checklist | null {
  if (input.archived) return null;
  const haveRenewal = new Set(input.renewalTypes.map(kindOfRenewalType));
  const haveDocument = new Set(input.documentKinds.filter(isDocKind));
  const rows: ChecklistRow[] = [];
  for (const { key, label } of CHECKLIST_KINDS) {
    const mode = paperMode(key as PaperKind, input.can);
    if (mode === null) continue;
    const done = key === "book" ? haveDocument.has("book") : haveRenewal.has(key) || (mode === "document" && haveDocument.has(key));
    rows.push({ kind: key, label, hint: hintFor(key, mode, input.askOdometer), done });
  }
  const done = rows.filter((r) => r.done).length;
  if (rows.length === 0 || done === rows.length) return null;
  return { rows, done, total: rows.length };
}

/**
 * The quiet line under the card of a vehicle with nothing recorded: what can come any time, from Add. It says only
 * what this person can do (a person who may add papers but no services is not told about services), and null when
 * there is nothing to say. `oilMonths` is the rule in force (Settings), so the line never states a number the hub
 * does not use.
 */
export function checklistFootnote(can: { service: boolean; reading: boolean }, oilMonths: number): string | null {
  const what = can.service && can.reading ? "A service or an odometer reading" : can.service ? "A service" : can.reading ? "An odometer reading" : null;
  if (!what) return null;
  const marker = can.service ? ` The first oil change sets the ${oilMonths}-month marker.` : "";
  return `${what} can come any time from Add.${marker}`;
}

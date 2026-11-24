import { daysBetween } from "@/lib/dates";
import type { OilState, OverviewRenewal, OverviewService, SheetAccess } from "./overview";
import { isOilChangeType, latestPerType, type OilRules } from "./service-logic";
import { currentRenewals } from "./renewal-logic";
import { renewDue, toneOfDays, type PaperFile } from "./papers";

/**
 * What a detail sheet (V.2, C149) shows and lets a person do, worked out from the record, the person's access
 * and whether this is the demo. Pure, so the access rules are tested without a browser: a person without
 * Vehicle documents See gets `files: null` (no tile, no name, nothing), whatever the loader had; a person who
 * may only see Vehicles gets no Edit, Delete or Renew; the demo has sample file rows but no real files, so it
 * offers no download, replace or upload.
 */

/** An attachment row as the sheet needs it. */
export type SheetFile = PaperFile;

export type RenewalSheetModel = {
  isCurrent: boolean;
  /** Days to the end (negative when late). */
  days: number;
  tone: "ok" | "soon" | "overdue";
  /** How full a full ring is. */
  span: number;
  /** Its files, or null when this person may not see Vehicle documents: then nothing about a file is shown. */
  files: SheetFile[] | null;
  /** Earlier records of the same type (ended before this one), newest first. */
  earlier: OverviewRenewal[];
  can: {
    edit: boolean;
    delete: boolean;
    /** Inside the renew window (or late), for the current record. */
    renew: boolean;
    /** The "no scan yet" tile's action. */
    addScan: boolean;
    download: boolean;
    replace: boolean;
  };
};

const sameType = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function renewalSheet(input: {
  renewal: OverviewRenewal;
  /** Every renewal of the vehicle. */
  renewals: readonly OverviewRenewal[];
  /** The record's files, as loaded; ignored (never shown) without `access.canSeeFiles`. */
  files: readonly SheetFile[];
  today: string;
  access: SheetAccess;
  sample: boolean;
}): RenewalSheetModel {
  const { renewal: r, access, sample } = input;
  const days = daysBetween(input.today, r.expiryDate);
  const isCurrent = currentRenewals(input.renewals).some((c) => c.id === r.id);
  const files = access.canSeeFiles ? [...input.files].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) : null;
  const has = files !== null && files.length > 0;
  return {
    isCurrent,
    days,
    tone: toneOfDays(days),
    span: r.startDate ? Math.max(1, daysBetween(r.startDate, r.expiryDate)) : 365,
    files,
    earlier: input.renewals
      .filter((o) => o.id !== r.id && sameType(o.type, r.type) && o.expiryDate < r.expiryDate)
      .sort((a, b) => b.expiryDate.localeCompare(a.expiryDate)),
    can: {
      edit: access.canEdit,
      delete: access.canEdit,
      renew: access.canEdit && isCurrent && renewDue(days),
      addScan: files !== null && !has && access.canAddFile && !sample,
      download: has && !sample,
      replace: has && access.canEditFiles && !sample,
    },
  };
}

export type ServiceSheetModel = {
  /** The amber card, for a service of an oil-change type. */
  oil:
    | null
    | {
        /** The newest oil-change service decides the marker; an older one is replaced by it. */
        current: boolean;
        markerDate: string | null;
        days: number | null;
        tone: "ok" | "soon" | "overdue" | null;
        km: { driven: number; of: number } | null;
      };
  /** Any other service with a next-due date: the date, the days and whether it still reminds. */
  nextDue: null | { date: string; days: number; reminds: boolean };
  files: SheetFile[] | null;
  can: {
    edit: boolean;
    delete: boolean;
    /** "Add the invoice": a service with no file yet. */
    addInvoice: boolean;
    /** Delete one of its files. */
    deleteFile: boolean;
    /** The tucked "Manage files" list (add another, delete any): it has files and the person may add or delete them. */
    manageFiles: boolean;
    download: boolean;
  };
};

export function serviceSheet(input: {
  service: OverviewService;
  services: readonly OverviewService[];
  oil: OilState;
  rules: OilRules;
  files: readonly SheetFile[];
  today: string;
  access: SheetAccess;
  sample: boolean;
}): ServiceSheetModel {
  const { service: s, access, sample } = input;
  const files = access.canSeeFiles ? [...input.files].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) : null;
  const isOil = isOilChangeType(s.serviceType, input.rules);
  const decides = latestPerType(input.services, input.rules.oilChangeTypes).some((c) => c.id === s.id);

  let oil: ServiceSheetModel["oil"] = null;
  if (isOil) {
    const current = decides && input.oil.has && input.oil.serviceId === s.id;
    const days = current && s.nextDueDate ? daysBetween(input.today, s.nextDueDate) : null;
    oil = {
      current,
      markerDate: s.nextDueDate,
      days,
      tone: days === null ? null : toneOfDays(days),
      km: current && input.oil.has ? input.oil.km : null,
    };
  }
  const nextDue = !isOil && s.nextDueDate ? { date: s.nextDueDate, days: daysBetween(input.today, s.nextDueDate), reminds: decides } : null;

  return {
    oil,
    nextDue,
    files,
    can: {
      edit: access.canEdit,
      delete: access.canEdit,
      addInvoice: files !== null && files.length === 0 && access.canAddFile && !sample,
      deleteFile: files !== null && files.length > 0 && access.canEditFiles && !sample,
      manageFiles: files !== null && files.length > 0 && (access.canAddFile || access.canEditFiles) && !sample,
      download: files !== null && files.length > 0 && !sample,
    },
  };
}

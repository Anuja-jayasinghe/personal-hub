"use server";

import { eq, inArray, and } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, type Db } from "@/db";
import { attachments, vehicleRenewals, vehicleServices, vehicles } from "@/db/schema";
import { allows, type Access } from "@/features/people/access";
import { loadRules } from "@/features/settings/queries";
import { discardUpload, insertAttachment, signUpload, verifyUpload } from "@/features/shared/files";
import { UUID_RE, ValidationError } from "@/features/shared/validation";
import { requireUser } from "@/lib/auth";
import { todayInAppTz } from "@/lib/format";
import type { OwnerRef } from "@/lib/owners";
import { pathBelongsTo } from "@/lib/upload-rules";
import { appConfig } from "@/config/app.config";
import { vehicleDocFileName } from "./doc-naming";
import { vehiclePart } from "./doc-names";
import {
  dayText,
  isPaperKind,
  paperFileName,
  paperMode,
  parsePaper,
  twinMessage,
  type ParsedPaper,
  type PaperCan,
  type PaperInput,
  type PreparePaperResult,
  type RenewalPaperKind,
  type SavePaperResult,
} from "./paper-flow";
import { placeRenewal, renewedMoment } from "./renewal-logic";
import { markRenewed } from "./renewal-write";

/**
 * The one flow for adding a paper (V.1b, C148). A paper makes its own record, and either everything is saved or
 * nothing is.
 *
 * Why two actions: the file goes straight from the browser to private storage (C115; Vercel caps a request at
 * 4.5 MB), into a folder named after the record that will own it (`<ownerType>/<ownerId>/...`), so the record's id
 * has to exist before the upload. `preparePaper` checks everything and only picks that id (no row is written) and
 * returns the one-time upload link. `savePaper` then runs ALL the database writes in ONE transaction: the record
 * with that id, the file's row, and marking the previous record renewed. If anything in it fails, the transaction
 * is rolled back and the uploaded object is removed (never one a saved file uses); if the upload fails, nothing
 * was created. Both actions decide everything again from the caller's real access and the stored data: the browser
 * only says what it typed.
 */

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** A same-day record without a scan exists: the file can go on it instead of making a second record. */
class AttachOffer extends ValidationError {}

type Plan = {
  vehicle: { id: string; nickname: string; registrationNumber: string | null; ignoreEmissionOdometer: boolean };
  can: PaperCan;
  parsed: ParsedPaper;
  /** Where the file goes; null when there is no file. */
  owner: OwnerRef | null;
  /** The id the new record gets (also the id of its folder in storage). */
  newId: string;
  /** The existing same-day record that gets the file instead of a new record. */
  attachTo: string | null;
};

const asText = (v: unknown, max = 500): string => (typeof v === "string" ? v.slice(0, max) : "");

/** What a caller of an action may do, from their real access. */
function capabilities(access: Access): PaperCan {
  return { records: allows(access, "vehicles", "add"), files: allows(access, "vehicle_documents", "add") };
}

/** The ids among `ids` that have at least one file. */
async function withFiles(reader: Pick<Db, "select">, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await reader
    .select({ ownerId: attachments.ownerId })
    .from(attachments)
    .where(and(eq(attachments.ownerType, "vehicle_renewal"), inArray(attachments.ownerId, [...ids])));
  return new Set(rows.map((r) => r.ownerId));
}

/** Reads what the browser sent, worked out against what the caller may do and what is stored. Writes nothing. */
async function planPaper(input: PaperInput, access: Access, wantsFile: boolean): Promise<Plan> {
  const can = capabilities(access);
  const kind = asText(input?.kind, 30);
  if (!isPaperKind(kind)) throw new ValidationError("Choose what the paper is.");
  const vehicleId = asText(input.vehicleId, 40);
  if (!UUID_RE.test(vehicleId)) throw new ValidationError("That vehicle could not be found.");
  if (paperMode(kind, can) === null) throw new ValidationError("You are not allowed to add this paper.");

  const [vehicle] = await db
    .select({ id: vehicles.id, nickname: vehicles.nickname, registrationNumber: vehicles.registrationNumber, ignoreEmissionOdometer: vehicles.ignoreEmissionOdometer })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId));
  if (!vehicle) throw new ValidationError("That vehicle could not be found.");

  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.fields ?? {})) if (typeof v === "string") raw[k.slice(0, 40)] = v.slice(0, 5000);
  const rules = await loadRules(db);
  const parsed = parsePaper(kind, can, raw, {
    today: todayInAppTz(),
    renewalTypes: appConfig.vehicles.renewalTypes.map((t) => t.label),
    ignoreEmissionOdometer: vehicle.ignoreEmissionOdometer,
    oil: rules,
  });
  if (!parsed.ok) throw new ValidationError(parsed.error);

  if (wantsFile && !can.files) throw new ValidationError("Adding the file needs Add access to Vehicle documents.");
  if (parsed.value.mode === "document" && !wantsFile) throw new ValidationError("Choose a file to add.");

  let newId: string = crypto.randomUUID();
  if (wantsFile) {
    const given = asText(input.upload?.ownerId, 40);
    if (input.upload) {
      if (!UUID_RE.test(given)) throw new ValidationError("That upload does not belong here. Please try again.");
      newId = given;
    }
  }

  let attachTo: string | null = null;
  if (parsed.value.mode === "renewal") {
    const rows = await db.select().from(vehicleRenewals).where(eq(vehicleRenewals.vehicleId, vehicle.id));
    const placement = placeRenewal(rows, parsed.value.renewal);
    if (placement.kind === "twin") attachTo = await chooseTwin(db, placement.twins, parsed.value.kind, parsed.value.renewal.expiryDate, wantsFile && input.attach === true, wantsFile);
  }

  const owner: OwnerRef | null = !wantsFile
    ? null
    : parsed.value.mode === "renewal"
      ? { ownerType: "vehicle_renewal", ownerId: attachTo ?? newId }
      : parsed.value.mode === "service"
        ? { ownerType: "vehicle_service", ownerId: newId }
        : { ownerType: "vehicle", ownerId: vehicle.id };
  return { vehicle, can, parsed: parsed.value, owner, newId, attachTo };
}

/**
 * A record of the same kind ending the same day exists (no duplicates). With a scan already on every one of
 * them it is refused; one without a scan can be given the file, but only when the person asked for that.
 */
async function chooseTwin(reader: Pick<Db, "select">, twins: readonly { id: string }[], kind: RenewalPaperKind, expiry: string, attach: boolean, hasFile: boolean): Promise<string> {
  const filed = await withFiles(reader, twins.map((t) => t.id));
  const free = twins.find((t) => !filed.has(t.id));
  const when = dayText(expiry);
  if (!free) throw new ValidationError(twinMessage(kind, when, true));
  if (!hasFile) throw new ValidationError(twinMessage(kind, when, false));
  if (!attach) throw new AttachOffer(twinMessage(kind, when, false));
  return free.id;
}

function failure(err: unknown): { ok: false; error: string; canAttach?: boolean } {
  if (err instanceof AttachOffer) return { ok: false, error: err.message, canAttach: true };
  if (err instanceof ValidationError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

/**
 * Step 1: checks who is asking and what for, reads the fields, refuses a duplicate, and returns a one-time upload link
 * for the folder the file will live in. Writes nothing.
 */
export async function preparePaper(input: PaperInput): Promise<PreparePaperResult> {
  try {
    const { access } = await requireUser("signed-in");
    const file = input?.file;
    if (!file) throw new ValidationError("Choose a file to upload.");
    const plan = await planPaper(input, access, true);
    const owner = plan.owner as OwnerRef;
    const mimeType = asText(file.mimeType, 100);
    const name = paperFileName(plan.parsed, vehiclePart(plan.vehicle), mimeType);
    const signed = await signUpload(owner, { fileName: name, mimeType, size: Number(file.size) });
    return { ok: true, ownerId: owner.ownerId, ...signed };
  } catch (err) {
    return failure(err);
  }
}

/** Writes the record, its file and the renewal bookkeeping. Runs inside the one transaction. */
async function writePaper(tx: Tx, plan: Plan, file: { path: string; fileName: string; size: number; mimeType: string } | null): Promise<void> {
  const { parsed, vehicle } = plan;
  const stored = file ? { size: file.size, mimeType: file.mimeType } : null;
  const put = (owner: OwnerRef, title: string | null = null) => (file && stored ? insertAttachment(tx, owner, { path: file.path, fileName: file.fileName }, stored, title) : Promise.resolve(null));

  if (parsed.mode === "document") {
    await put({ ownerType: "vehicle", ownerId: vehicle.id }, parsed.doc.title);
    return;
  }

  // Two papers saved at the same moment must not both become the current one: saves for a vehicle take turns.
  await tx.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicle.id)).for("update");

  if (parsed.mode === "service") {
    await tx.insert(vehicleServices).values({ id: plan.newId, vehicleId: vehicle.id, ...parsed.service });
    await put({ ownerType: "vehicle_service", ownerId: plan.newId });
    return;
  }

  const rows = await tx.select().from(vehicleRenewals).where(eq(vehicleRenewals.vehicleId, vehicle.id));
  const placement = placeRenewal(rows, parsed.renewal);
  if (placement.kind === "twin") {
    // Decided again inside the transaction, so a twin made a moment ago is seen too.
    const id = await chooseTwin(tx, placement.twins, parsed.kind, parsed.renewal.expiryDate, plan.attachTo !== null, file !== null);
    if (id !== plan.attachTo) throw new ValidationError("That paper changed while it was being saved. Please try again.");
    await put({ ownerType: "vehicle_renewal", ownerId: id });
    return;
  }
  if (plan.attachTo) throw new ValidationError("That paper changed while it was being saved. Please try again.");

  const at = renewedMoment(placement.renewedOn);
  if (placement.kind === "current") await markRenewed(tx, placement.renew.map((r) => r.id), at);
  await tx.insert(vehicleRenewals).values({ id: plan.newId, vehicleId: vehicle.id, ...parsed.renewal, renewedAt: placement.kind === "history" ? at : null });
  await put({ ownerType: "vehicle_renewal", ownerId: plan.newId });
}

/**
 * Step 2: saves the paper. Everything it does to the database is one transaction. When the paper has a file, the
 * browser has already put it in storage with the link from `preparePaper`; what arrived is checked again here.
 */
export async function savePaper(input: PaperInput): Promise<SavePaperResult> {
  try {
    const { access } = await requireUser("signed-in");
    return await savePaperAs(input, access);
  } catch (err) {
    return failure(err);
  }
}

/** The save itself, for a person already checked; removes the uploaded object whenever the save does not happen. */
async function savePaperAs(input: PaperInput, access: Access): Promise<SavePaperResult> {
  try {
    const upload = input?.upload ?? null;
    const plan = await planPaper(input, access, upload !== null);

    let file: { path: string; fileName: string; size: number; mimeType: string } | null = null;
    if (upload && plan.owner) {
      const path = asText(upload.path, 400);
      const stored = await verifyUpload(plan.owner, path);
      const fileName =
        plan.parsed.mode === "document"
          ? await vehicleDocFileName(plan.vehicle.id, plan.parsed.doc, stored.mimeType)
          : paperFileName(plan.parsed, vehiclePart(plan.vehicle), stored.mimeType);
      file = { path, fileName, ...stored };
    }

    await db.transaction((tx) => writePaper(tx, plan, file));
    refresh();
    return { ok: true };
  } catch (err) {
    // Whatever went wrong, a file the browser just put in storage for this save must not be left behind.
    await discardOwnUpload(input, access);
    return failure(err);
  }
}

/**
 * Removes the object of an upload that did not become a saved paper. Only for a person who may add files, and only
 * a path inside the folder of the id the browser was given (a new record's, or the vehicle's own): never another
 * record's folder, and never an object a saved file uses (`discardUpload` checks).
 */
async function discardOwnUpload(input: PaperInput, access: Access): Promise<void> {
  const path = asText(input?.upload?.path, 400);
  if (!path || !allows(access, "vehicle_documents", "add")) return;
  const id = asText(input.upload?.ownerId, 40);
  const vehicleId = asText(input.vehicleId, 40);
  const folders: OwnerRef[] = [];
  if (UUID_RE.test(id)) folders.push({ ownerType: "vehicle_renewal", ownerId: id }, { ownerType: "vehicle_service", ownerId: id });
  if (UUID_RE.test(vehicleId)) folders.push({ ownerType: "vehicle", ownerId: vehicleId });
  if (folders.some((owner) => pathBelongsTo(path, owner))) await discardUpload(path);
}

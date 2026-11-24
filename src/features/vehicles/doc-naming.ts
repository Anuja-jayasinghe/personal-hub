import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments, vehicleRenewals, vehicleServices, vehicles } from "@/db/schema";
import { ValidationError } from "@/features/shared/validation";
import { docFileName, documentKind, extensionFor, renewalKind, SERVICE_FILE_KIND, vehiclePart, type DocUpload } from "./doc-names";

/**
 * Names a vehicle document from the hub's own data (issue #179), never from the uploader's file name.
 * Used by the upload actions after they have checked the person; reads the real database for that
 * reason (allowed in read-guard.test.ts, like the other file housekeeping).
 */

async function takenNames(ownerType: string, ownerId: string): Promise<string[]> {
  const rows = await db
    .select({ fileName: attachments.fileName })
    .from(attachments)
    .where(and(eq(attachments.ownerType, ownerType), eq(attachments.ownerId, ownerId)));
  return rows.map((r) => r.fileName);
}

/** A file on a renewal: the vehicle's plate, the renewal's type and its expiry. */
export async function renewalFileName(renewalId: string, mimeType: string): Promise<string> {
  const [row] = await db
    .select({ type: vehicleRenewals.type, expiry: vehicleRenewals.expiryDate, registrationNumber: vehicles.registrationNumber, nickname: vehicles.nickname })
    .from(vehicleRenewals)
    .innerJoin(vehicles, eq(vehicles.id, vehicleRenewals.vehicleId))
    .where(eq(vehicleRenewals.id, renewalId));
  if (!row) throw new ValidationError("That renewal could not be found.");
  return docFileName({ vehicle: vehiclePart(row), kind: renewalKind(row.type), date: row.expiry, ext: extensionFor(mimeType) }, await takenNames("vehicle_renewal", renewalId));
}

/**
 * A file on a service (V.1a, C147): the plate of the vehicle the service belongs to (looked up from the
 * service itself, never taken from the request) and the service's date. Throws when the service is not there,
 * which is also what stops a file being attached to a record that does not exist.
 */
export async function serviceFileName(serviceId: string, mimeType: string): Promise<string> {
  const [row] = await db
    .select({ date: vehicleServices.serviceDate, registrationNumber: vehicles.registrationNumber, nickname: vehicles.nickname })
    .from(vehicleServices)
    .innerJoin(vehicles, eq(vehicles.id, vehicleServices.vehicleId))
    .where(eq(vehicleServices.id, serviceId));
  if (!row) throw new ValidationError("That service could not be found.");
  return docFileName({ vehicle: vehiclePart(row), kind: SERVICE_FILE_KIND, date: row.date, ext: extensionFor(mimeType) }, await takenNames("vehicle_service", serviceId));
}

/** A Documents upload: the vehicle's plate and what the form asked (kind and date). */
export async function vehicleDocFileName(vehicleId: string, doc: DocUpload, mimeType: string): Promise<string> {
  const [vehicle] = await db.select({ registrationNumber: vehicles.registrationNumber, nickname: vehicles.nickname }).from(vehicles).where(eq(vehicles.id, vehicleId));
  if (!vehicle) throw new ValidationError("That vehicle could not be found.");
  return docFileName({ vehicle: vehiclePart(vehicle), kind: documentKind(doc.kind, doc.title), date: doc.date, ext: extensionFor(mimeType) }, await takenNames("vehicle", vehicleId));
}

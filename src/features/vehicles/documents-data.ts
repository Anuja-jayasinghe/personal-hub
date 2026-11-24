import "server-only";
import type { Attachment } from "@/db/schema";
import { attachmentsByOwner } from "@/features/shared/queries";
import { listRenewals, listServices } from "./queries";
import type { DocKind } from "./doc-names";
import { buildPapers, paperFromDocument, type PaperFile } from "./papers";

/**
 * Everything the Documents tab reads about one vehicle (V.4, C151): its own documents (never the cover photo), its
 * renewals with their files and its services with their invoices, in four queries plus two for the files, however
 * many records there are. Everything is looked up by THIS vehicle's own ids, so another vehicle's invoice can never
 * appear here. Reads go through the query modules, so a demo visitor only ever sees the demo's data. Use inside <Suspense>.
 */

const toFile = (a: Attachment): PaperFile => ({ id: a.id, ownerType: a.ownerType, ownerId: a.ownerId, fileName: a.fileName, title: a.title, mimeType: a.mimeType, sizeBytes: a.sizeBytes, createdAt: a.createdAt });

/**
 * The kinds of the vehicle's own documents (never the cover photo), for the new-vehicle checklist: one query. Only
 * ask for a person who may add papers as files (the checklist offers nothing else, and nobody else is told what is on file).
 */
export async function loadDocumentKinds(vehicleId: string, coverAttachmentId: string | null): Promise<DocKind[]> {
  const own = await attachmentsByOwner("vehicle", [vehicleId]);
  return (own.get(vehicleId) ?? []).filter((a) => a.id !== coverAttachmentId).map((a) => paperFromDocument(toFile(a)).kind);
}

export async function loadVehiclePapers(vehicleId: string, coverAttachmentId: string | null) {
  const [own, renewals, services] = await Promise.all([attachmentsByOwner("vehicle", [vehicleId]), listRenewals(vehicleId), listServices(vehicleId)]);
  const [renewalFiles, serviceFiles] = await Promise.all([
    attachmentsByOwner("vehicle_renewal", renewals.map((r) => r.id)),
    attachmentsByOwner("vehicle_service", services.map((s) => s.id)),
  ]);
  const documents = (own.get(vehicleId) ?? []).filter((a) => a.id !== coverAttachmentId).map(toFile);
  const papers = buildPapers({
    renewals,
    renewalFiles: new Map([...renewalFiles].map(([id, list]) => [id, list.map(toFile)])),
    documents,
    services,
    serviceFiles: new Map([...serviceFiles].map(([id, list]) => [id, list.map(toFile)])),
  });
  return { papers, renewals, documents };
}

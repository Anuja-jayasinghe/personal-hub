import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { attachmentsByOwner } from "@/features/shared/queries";

/**
 * Documents and photos that belong to the vehicle itself (registration book, photos beyond the
 * cover). The cover photo is managed on the Overview tab, so it is left out of this list.
 */
export async function VehicleFiles({ vehicleId, coverAttachmentId }: { vehicleId: string; coverAttachmentId: string | null }) {
  const all = (await attachmentsByOwner("vehicle", [vehicleId])).get(vehicleId) ?? [];
  const items = all.filter((a) => a.id !== coverAttachmentId);

  return (
    <section aria-labelledby="vehicle-files" className="flex flex-col gap-3">
      <h2 id="vehicle-files" className="text-lg font-medium">
        Files
      </h2>
      <AttachmentsPanel owner={{ ownerType: "vehicle", ownerId: vehicleId }} items={items} />
    </section>
  );
}

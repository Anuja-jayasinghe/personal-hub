"use client";

import { PopoverButton } from "@/components/electricity/popover-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { ReplaceFileForm } from "@/components/vehicles/document-forms";
import { useCloseItemSheet } from "@/components/vehicles/item-sheet-shell";
import { RenewSheet } from "@/components/vehicles/vehicle-sheets";
import type { VehicleRenewal } from "@/db/schema";
import { deleteAttachment } from "@/features/shared/actions";
import { deleteRenewal } from "@/features/vehicles/renewal-actions";
import { deleteService } from "@/features/vehicles/service-actions";

/**
 * The client pieces inside a detail sheet (V.2, C149): the Renew button and the ⋯ menus. They sit apart from the
 * server-rendered sheet because they close it when the record goes away. Which of them show is decided on the
 * server from the person's access; the actions check again.
 */

/** "Renew", full width, closing the sheet once saved (the record shown is then an earlier one). */
export function RenewFromSheet({ renewal, vehicleName, types, askOdometer }: { renewal: VehicleRenewal; vehicleName: string; types: readonly string[]; askOdometer: boolean }) {
  const close = useCloseItemSheet();
  return (
    <div className="[&>button]:w-full">
      <RenewSheet renewal={renewal} vehicleName={vehicleName} types={types} askOdometer={askOdometer} variant="default" size="lg" onDone={close} />
    </div>
  );
}

const rare = "font-mono text-[10px] tracking-[0.14em] text-label uppercase";

/** The rare things on a renewal behind ⋯: replace its file, delete the record (and its files). */
export function RenewalMenu({
  renewalId,
  type,
  replaceFileId,
  canDelete,
}: {
  renewalId: string;
  type: string;
  /** The file Replace changes; null when this person may not replace files (or there is none). */
  replaceFileId: string | null;
  canDelete: boolean;
}) {
  const closeSheet = useCloseItemSheet();
  return (
    <PopoverButton icon="more" ariaLabel="More: replace file, delete" align="end" variant="outline" className="size-12 rounded-xl">
      {(close) => (
        <div className="flex w-72 flex-col gap-3 p-1.5">
          {replaceFileId ? (
            <div className="flex flex-col gap-2">
              <span className={rare}>Replace the file</span>
              <ReplaceFileForm id={replaceFileId} owner={{ ownerType: "vehicle_renewal", ownerId: renewalId }} onDone={close} />
            </div>
          ) : null}
          {canDelete ? (
            <form
              action={async (fd) => {
                close();
                await deleteRenewal(fd);
                closeSheet();
              }}
              className={replaceFileId ? "border-t pt-3" : undefined}
            >
              <input type="hidden" name="id" value={renewalId} />
              <SubmitButton variant="ghost" size="sm" className="w-full text-status-overdue" confirm={`Delete this ${type.toLowerCase()} and its files? This cannot be undone.`}>
                Delete this record…
              </SubmitButton>
            </form>
          ) : null}
        </div>
      )}
    </PopoverButton>
  );
}

/** The rare things on a service behind ⋯: delete its invoice, delete the record (and its files). */
export function ServiceMenu({ serviceId, serviceType, deleteFileId, canDelete }: { serviceId: string; serviceType: string; deleteFileId: string | null; canDelete: boolean }) {
  const closeSheet = useCloseItemSheet();
  return (
    <PopoverButton icon="more" ariaLabel="More: delete" align="end" variant="outline" className="size-12 rounded-xl">
      {(close) => (
        <div className="flex w-72 flex-col gap-2 p-1.5">
          {deleteFileId ? (
            <form
              action={async (fd) => {
                close();
                await deleteAttachment(fd);
              }}
            >
              <input type="hidden" name="id" value={deleteFileId} />
              <SubmitButton variant="ghost" size="sm" className="w-full text-status-overdue" confirm="Delete this file? This cannot be undone.">
                Delete the invoice file…
              </SubmitButton>
            </form>
          ) : null}
          {canDelete ? (
            <form
              action={async (fd) => {
                close();
                await deleteService(fd);
                closeSheet();
              }}
              className={deleteFileId ? "border-t pt-2" : undefined}
            >
              <input type="hidden" name="id" value={serviceId} />
              <SubmitButton variant="ghost" size="sm" className="w-full text-status-overdue" confirm={`Delete this ${serviceType.toLowerCase()} record and its files? This cannot be undone.`}>
                Delete this service…
              </SubmitButton>
            </form>
          ) : null}
        </div>
      )}
    </PopoverButton>
  );
}

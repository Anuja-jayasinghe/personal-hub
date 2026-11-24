import Link from "next/link";
import { PopoverButton } from "@/components/electricity/popover-button";
import { SubmitButton } from "@/components/shared/submit-button";
import { CoverPhotoForm } from "@/components/vehicles/cover-photo-form";
import { buttonVariants } from "@/components/ui/button";
import type { Vehicle } from "@/db/schema";
import { archiveVehicle, deleteVehicle, removeVehicleCover, unarchiveVehicle } from "@/features/vehicles/actions";
import { vehiclePath } from "@/features/vehicles/plate";

/**
 * One menu for a vehicle's rare actions (S.6, C112; owner's item 24; design board "Vehicles"): change or
 * remove the photo, edit the details, archive or bring back, delete. They used to be spread over the
 * page; now they sit together behind "Manage", tucked away because they are rare. Delete asks first.
 */
export function VehicleManageMenu({ vehicle }: { vehicle: Vehicle }) {
  return (
    <PopoverButton label="Manage" icon="chevron" align="end" variant="outline" className="h-[46px] rounded-[14px] px-4 text-sm md:h-[42px] md:rounded-xl">
      <div className="flex w-72 flex-col gap-3 p-1">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] tracking-[0.14em] text-label uppercase">Photo</span>
          <CoverPhotoForm vehicleId={vehicle.id} hasCover={vehicle.coverAttachmentId !== null} />
          {vehicle.coverAttachmentId ? (
            <form action={removeVehicleCover}>
              <input type="hidden" name="id" value={vehicle.id} />
              <SubmitButton variant="ghost" size="sm" confirm="Remove the photo?">
                Remove photo
              </SubmitButton>
            </form>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 border-t pt-3">
          <Link href={vehiclePath(vehicle, "/edit")} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Edit details
          </Link>
          {vehicle.archivedAt ? (
            <form action={unarchiveVehicle}>
              <input type="hidden" name="id" value={vehicle.id} />
              <SubmitButton variant="outline" size="sm" className="w-full">
                Bring back from the archive
              </SubmitButton>
            </form>
          ) : (
            <form action={archiveVehicle}>
              <input type="hidden" name="id" value={vehicle.id} />
              <SubmitButton variant="outline" size="sm" className="w-full" confirm={`Archive "${vehicle.nickname}"? It is hidden and stops reminding; its history is kept.`}>
                Archive (sold or no longer yours)
              </SubmitButton>
            </form>
          )}
          <form action={deleteVehicle}>
            <input type="hidden" name="id" value={vehicle.id} />
            <SubmitButton
              variant="ghost"
              size="sm"
              className="w-full text-status-overdue"
              confirm={`Permanently delete "${vehicle.nickname}" with all its notes and files? This cannot be undone.`}
            >
              Delete permanently…
            </SubmitButton>
          </form>
        </div>
      </div>
    </PopoverButton>
  );
}

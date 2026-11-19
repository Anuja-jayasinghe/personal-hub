import Link from "next/link";
import { VehicleCover } from "@/components/vehicles/vehicle-cover";
import { appConfig } from "@/config/app.config";
import type { Vehicle } from "@/db/schema";
import { findVehicleType } from "@/features/vehicles/vehicle-type";

/** One vehicle in the list (board HVehicles): the photo or the car render, the name, make / model / year, the plate and what is due. */
export function VehicleCard({ vehicle, due }: { vehicle: Vehicle; due?: { total: number; overdue: number } }) {
  const subtitle = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ");
  const type = findVehicleType(appConfig.vehicles.types, vehicle.vehicleType);
  return (
    <li>
      <Link
        href={`/vehicles/${vehicle.id}`}
        className="flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <VehicleCover vehicleId={vehicle.id} coverAttachmentId={vehicle.coverAttachmentId} vehicleType={vehicle.vehicleType} alt="" className="h-36 w-full" />
        <div className="flex flex-col gap-1.5 px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-display text-xl font-semibold tracking-tight">{vehicle.nickname}</p>
            {vehicle.registrationNumber ? (
              <span className="shrink-0 rounded-md bg-foreground px-2 py-0.5 font-mono text-xs font-semibold text-background">{vehicle.registrationNumber}</span>
            ) : null}
          </div>
          <p className="truncate font-mono text-[10.5px] tracking-wide text-label uppercase">
            {[subtitle, type?.label].filter(Boolean).join(" · ")}
            {vehicle.archivedAt ? " · archived" : ""}
          </p>
          {due && due.total > 0 ? (
            <span
              className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                due.overdue > 0 ? "bg-status-overdue-soft text-status-overdue" : "bg-status-soon-soft text-status-soon"
              }`}
            >
              <span aria-hidden className={`size-1.5 rounded-full ${due.overdue > 0 ? "bg-status-overdue" : "bg-status-soon-mark"}`} />
              {due.overdue > 0 ? `${due.overdue} overdue` : `${due.total} due`}
              {due.overdue > 0 && due.total > due.overdue ? ` · ${due.total - due.overdue} due` : ""}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

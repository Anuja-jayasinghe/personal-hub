import Link from "next/link";
import { GovPlate } from "@/components/vehicles/gov-plate";
import { VehicleCover } from "@/components/vehicles/vehicle-cover";
import { appConfig } from "@/config/app.config";
import type { Vehicle } from "@/db/schema";
import { vehiclePath } from "@/features/vehicles/plate";
import { findVehicleType } from "@/features/vehicles/vehicle-type";

/**
 * One vehicle in the list (S.6, C112; design board "Vehicles"): photo first, since most vehicles will
 * have a real photo; the government-style Sri Lankan plate (C130) sits on the photo; then the name, make / model / year and what
 * is due. Without a photo, the stage with the car render or the type's icon.
 */
export function VehicleCard({ vehicle, due }: { vehicle: Vehicle; due?: { total: number; overdue: number } }) {
  const subtitle = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ");
  const type = findVehicleType(appConfig.vehicles.types, vehicle.vehicleType);
  return (
    <li>
      <Link
        href={vehiclePath(vehicle)}
        className="flex h-full flex-col overflow-hidden rounded-3xl border bg-card text-card-foreground outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="relative block">
          <VehicleCover
            vehicleId={vehicle.id}
            coverAttachmentId={vehicle.coverAttachmentId}
            vehicleType={vehicle.vehicleType}
            alt=""
            className="aspect-[16/10] w-full"
          />
          {vehicle.registrationNumber ? <GovPlate registration={vehicle.registrationNumber} className="absolute bottom-3 left-3" /> : null}
        </span>
        <span className="flex items-center gap-3 px-4 pt-3.5 pb-4">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-display text-xl font-semibold tracking-tight">{vehicle.nickname}</span>
            <span className="truncate font-mono text-[10.5px] tracking-wide text-label uppercase">
              {[subtitle, type?.label].filter(Boolean).join(" · ")}
              {vehicle.archivedAt ? " · archived" : ""}
            </span>
          </span>
          {due && due.total > 0 ? (
            <span className="flex shrink-0 flex-col items-end">
              <span className={`font-display text-2xl leading-none font-semibold ${due.overdue > 0 ? "text-status-overdue" : "text-status-soon"}`}>
                {due.overdue > 0 ? due.overdue : due.total}
              </span>
              <span className="text-[11px] text-muted-foreground">{due.overdue > 0 ? "overdue" : "due soon"}</span>
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

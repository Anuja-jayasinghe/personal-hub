import Link from "next/link";
import { VehicleCover } from "@/components/vehicles/vehicle-cover";
import { Badge } from "@/components/ui/badge";
import { appConfig } from "@/config/app.config";
import type { Vehicle } from "@/db/schema";
import { findVehicleType } from "@/features/vehicles/vehicle-type";

/** One vehicle in the list: cover photo, nickname, make / model / year and registration number. */
export function VehicleCard({ vehicle, due }: { vehicle: Vehicle; due?: { total: number; overdue: number } }) {
  const subtitle = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ");
  const type = findVehicleType(appConfig.vehicles.types, vehicle.vehicleType);
  return (
    <li>
      <Link
        href={`/vehicles/${vehicle.id}`}
        className="flex overflow-hidden rounded-xl border bg-card text-card-foreground transition-colors hover:bg-accent"
      >
        <VehicleCover coverAttachmentId={vehicle.coverAttachmentId} vehicleType={vehicle.vehicleType} alt="" className="h-24 w-28 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
          <p className="truncate font-medium">{vehicle.nickname}</p>
          {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="flex flex-wrap items-center gap-1.5">
            {type ? <Badge variant="secondary">{type.label}</Badge> : null}
            {vehicle.registrationNumber ? <Badge variant="outline">{vehicle.registrationNumber}</Badge> : null}
            {vehicle.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
            {due && due.total > 0 ? (
              <Badge variant="outline" className={due.overdue > 0 ? "border-status-overdue text-status-overdue" : "border-status-soon text-status-soon"}>
                {due.overdue > 0 ? `${due.overdue} overdue` : `${due.total} due`}
                {due.overdue > 0 && due.total > due.overdue ? ` · ${due.total - due.overdue} due` : ""}
              </Badge>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

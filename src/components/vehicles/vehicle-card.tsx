import Link from "next/link";
import { VehicleCover } from "@/components/vehicles/vehicle-cover";
import { Badge } from "@/components/ui/badge";
import type { Vehicle } from "@/db/schema";

/** One vehicle in the list: cover photo, nickname, make / model / year and registration number. */
export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const subtitle = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ");
  return (
    <li>
      <Link
        href={`/vehicles/${vehicle.id}`}
        className="flex overflow-hidden rounded-xl border bg-card text-card-foreground transition-colors hover:bg-accent"
      >
        <VehicleCover coverAttachmentId={vehicle.coverAttachmentId} alt="" className="h-24 w-28 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
          <p className="truncate font-medium">{vehicle.nickname}</p>
          {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="flex flex-wrap items-center gap-1.5">
            {vehicle.registrationNumber ? <Badge variant="outline">{vehicle.registrationNumber}</Badge> : null}
            {vehicle.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

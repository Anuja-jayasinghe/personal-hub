import { CAR_LIKE_TYPES, CarRender } from "@/components/vehicles/car-render";
import { VehicleTypeIcon } from "@/components/vehicles/vehicle-icons";
import { appConfig } from "@/config/app.config";
import { findVehicleType } from "@/features/vehicles/vehicle-type";

/**
 * The vehicle's cover photo (through the signed-link route); without one, the car render for a
 * car-like type (R.5a, DESIGN.md The car) or the icon of its type (motorbike, bus...) on a deep panel.
 */
export function VehicleCover({
  vehicleId,
  coverAttachmentId,
  vehicleType,
  alt,
  className = "",
}: {
  vehicleId: string;
  coverAttachmentId: string | null;
  /** The vehicle's type key; picks the render or the placeholder icon. */
  vehicleType?: string | null;
  alt: string;
  className?: string;
}) {
  if (!coverAttachmentId) {
    const type = findVehicleType(appConfig.vehicles.types, vehicleType);
    if (CAR_LIKE_TYPES.has(type?.key ?? "car")) {
      return (
        <div className={`flex items-end justify-center overflow-hidden bg-[radial-gradient(120%_80%_at_50%_65%,color-mix(in_oklab,var(--primary)_14%,var(--deepest))_0%,var(--deepest)_62%)] ${className}`} aria-hidden>
          <CarRender idPrefix={`car-${vehicleId}`} className="w-full" />
        </div>
      );
    }
    return (
      <div className={`flex items-center justify-center bg-deepest text-muted-foreground ${className}`} aria-hidden>
        <VehicleTypeIcon name={type?.icon} className="size-10" />
      </div>
    );
  }
  // A plain <img>: /files/<id> redirects to a short-lived signed link, which Next's image optimiser can't follow.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/files/${coverAttachmentId}`} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}

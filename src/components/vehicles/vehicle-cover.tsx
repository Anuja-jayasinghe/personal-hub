import { VehicleTypeIcon } from "@/components/vehicles/vehicle-icons";
import { appConfig } from "@/config/app.config";
import { findVehicleType } from "@/features/vehicles/vehicle-type";

/** The vehicle's cover photo (through the signed-link route), or the icon of its type (car, motorbike...) when there is none. */
export function VehicleCover({
  coverAttachmentId,
  vehicleType,
  alt,
  className = "",
}: {
  coverAttachmentId: string | null;
  /** The vehicle's type key; picks the placeholder icon. */
  vehicleType?: string | null;
  alt: string;
  className?: string;
}) {
  if (!coverAttachmentId) {
    const iconName = findVehicleType(appConfig.vehicles.types, vehicleType)?.icon;
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`} aria-hidden>
        <VehicleTypeIcon name={iconName} className="size-8" />
      </div>
    );
  }
  // A plain <img>: /files/<id> redirects to a short-lived signed link, which Next's image optimiser can't follow.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/files/${coverAttachmentId}`} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}

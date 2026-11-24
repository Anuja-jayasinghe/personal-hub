import { BikeRender } from "@/components/vehicles/bike-render";
import { CarRender } from "@/components/vehicles/car-render";
import { VehicleTypeIcon } from "@/components/vehicles/vehicle-icons";
import { appConfig } from "@/config/app.config";
import type { Vehicle } from "@/db/schema";
import { vehicleLook } from "@/features/vehicles/vehicle-look";
import { findVehicleType } from "@/features/vehicles/vehicle-type";

const STAGE = "bg-[radial-gradient(120%_80%_at_50%_65%,color-mix(in_oklab,var(--primary)_14%,var(--deepest))_0%,var(--deepest)_62%)]";

/**
 * The vehicle's cover photo (through the signed-link route); without one, a drawing that looks like
 * the vehicle (issue #172): the sedan for a car-like type, a superbike, supermoto, commuter bike or
 * scooter picked from the type, make and model (`vehicleLook`), or the type's icon for the rest
 * (bus, three-wheeler...), on the deep stage.
 */
export function VehicleCover({
  vehicle,
  alt,
  className = "",
  priority = false,
  position,
  renderClassName = "w-full",
}: {
  vehicle: Pick<Vehicle, "id" | "coverAttachmentId" | "vehicleType" | "make" | "model">;
  alt: string;
  className?: string;
  /** The page's main image (the vehicle hero): load it at once and first, instead of lazily. */
  priority?: boolean;
  /** CSS object-position of a photo, to keep the vehicle in a crop (the owner's photos are portrait). */
  position?: string;
  /** Size classes of the drawing on its stage (default: the stage's width). */
  renderClassName?: string;
}) {
  if (vehicle.coverAttachmentId) {
    // A plain <img>: /files/<id> redirects to a short-lived signed link, which Next's image optimiser can't follow.
    // The page's main image loads eagerly with high priority; list cards stay lazy. Its box comes from the layout, so it never shifts the page.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/files/${vehicle.coverAttachmentId}`}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        style={position ? { objectPosition: position } : undefined}
        className={`object-cover ${className}`}
      />
    );
  }
  const look = vehicleLook(vehicle);
  const idPrefix = `render-${vehicle.id}`;
  if (look.family === "icon") {
    const type = findVehicleType(appConfig.vehicles.types, vehicle.vehicleType);
    return (
      <div className={`flex items-center justify-center bg-deepest text-muted-foreground ${className}`} aria-hidden>
        <VehicleTypeIcon name={type?.icon} className="size-10" />
      </div>
    );
  }
  return (
    <div className={`flex items-end justify-center overflow-hidden ${STAGE} ${className}`} aria-hidden>
      {look.family === "car" ? (
        <CarRender idPrefix={idPrefix} className={renderClassName} />
      ) : (
        <BikeRender idPrefix={idPrefix} kind={look.family === "scooter" ? "scooter" : look.kind} paint={look.paint} className={renderClassName} />
      )}
    </div>
  );
}

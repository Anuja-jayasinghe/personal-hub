import { Bike, Bus, Car, CarFront, CarTaxiFront, Motorbike, Scooter, Truck, Van, type LucideIcon } from "lucide-react";

/**
 * Maps the icon names used in `appConfig.vehicles.types` to lucide icons. Add a line here when a
 * new type needs a new icon name.
 */
const icons: Record<string, LucideIcon> = {
  car: Car,
  suv: CarFront,
  van: Van,
  truck: Truck,
  motorbike: Motorbike,
  scooter: Scooter,
  bicycle: Bike,
  "three-wheeler": CarTaxiFront,
  bus: Bus,
};

/** The icon for a vehicle type's icon name; a plain car for anything unknown or when no type is set. */
export function VehicleTypeIcon({ name, className }: { name: string | undefined; className?: string }) {
  const Icon: LucideIcon = icons[name ?? ""] ?? Car;
  return <Icon className={className} />;
}

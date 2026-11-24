import { ChevronRight } from "lucide-react";
import type { Vehicle } from "@/db/schema";

/**
 * The vehicle's details (type, make, model, year, fuel, registration) as a compact card, shut by default: the
 * hero already shows the name and the make / model / year, so this is the full list for when it is wanted.
 * A native <details>, so it needs no script and keeps its own keyboard behaviour.
 */
function Detail({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[10px] tracking-[0.14em] text-label uppercase">{term}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  );
}

export function VehicleDetailsCard({ vehicle, typeLabel }: { vehicle: Vehicle; typeLabel: string | undefined }) {
  return (
    <details className="group rounded-[18px] border bg-card md:rounded-[20px]">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-[inherit] px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-5 [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-[10.5px] font-normal tracking-[0.14em] text-label uppercase md:text-[11px]">Vehicle details</span>
        <ChevronRight aria-hidden className="ml-auto size-4 text-label transition-transform group-open:rotate-90 motion-reduce:transition-none" />
      </summary>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t px-4 py-4 md:px-5">
        <Detail term="Type" value={typeLabel} />
        <Detail term="Registration" value={vehicle.registrationNumber} />
        <Detail term="Make" value={vehicle.make} />
        <Detail term="Model" value={vehicle.model} />
        <Detail term="Year" value={vehicle.year} />
        <Detail term="Fuel" value={vehicle.fuelType} />
      </dl>
    </details>
  );
}

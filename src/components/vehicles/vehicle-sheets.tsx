"use client";

import { SheetButton } from "@/components/shared/sheet-button";
import { UploadForm } from "@/components/shared/upload-form";
import { OdometerForm } from "@/components/vehicles/odometer-form";
import { RenewalForm } from "@/components/vehicles/renewal-form";
import { ServiceForm } from "@/components/vehicles/service-form";
import type { VehicleRenewal } from "@/db/schema";
import { addOdometerReading } from "@/features/vehicles/odometer-actions";
import { renewRenewal } from "@/features/vehicles/renewal-actions";
import { createService } from "@/features/vehicles/service-actions";
import type { OilRules } from "@/features/vehicles/service-logic";

/**
 * The vehicle "add" forms as bottom sheets (R.5a; board HVehicleForms). Client wrappers, because a
 * sheet closes itself after saving and the tabs that show these buttons render on the server.
 */

export function AddServiceSheet({
  vehicleId,
  vehicleName,
  serviceTypes,
  defaultDate,
  oil,
  canAttach = false,
}: {
  vehicleId: string;
  vehicleName: string;
  serviceTypes: readonly string[];
  defaultDate: string;
  /** The oil-change rule in force (V.1a, C147), for the "Next oil change" card. */
  oil?: OilRules;
  /** May this person attach the invoice (Add in Vehicle documents)? */
  canAttach?: boolean;
}) {
  return (
    <SheetButton label="Add service" title="Add a service" crumb={`/ ${vehicleName} / New service`} variant="default">
      {(close) => <ServiceForm action={createService} serviceTypes={serviceTypes} vehicleId={vehicleId} defaultDate={defaultDate} oil={oil} canAttach={canAttach} onDone={close} />}
    </SheetButton>
  );
}

/** "Add the invoice" on a service (V.1a, C147): the record's own upload form in a sheet; the hub names the file `PLATE_service_<date>`. */
export function AddInvoiceSheet({ serviceId, serviceLabel, vehicleName, nameHint }: { serviceId: string; serviceLabel: string; vehicleName: string; nameHint: string }) {
  return (
    <SheetButton label="Add the invoice" title="Add the invoice" crumb={`/ ${vehicleName} / ${serviceLabel}`} variant="ghost" size="sm">
      {(close) => <UploadForm owner={{ ownerType: "vehicle_service", ownerId: serviceId }} nameHint={nameHint} onDone={close} />}
    </SheetButton>
  );
}

/**
 * "Renew" from the Documents tab (issue #187): the Renewals tab's own renew form in a sheet, so the renewal
 * record keeps one home (C102). The old record and its papers stay as history.
 */
export function RenewSheet({
  renewal,
  vehicleName,
  types,
  askOdometer = true,
  variant = "outline",
  size = "sm",
  onDone,
}: {
  renewal: VehicleRenewal;
  vehicleName: string;
  types: readonly string[];
  askOdometer?: boolean;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  onDone?: () => void;
}) {
  return (
    <SheetButton label="Renew" title={`Renew ${renewal.type.toLowerCase()}`} crumb={`/ ${vehicleName} / ${renewal.type}`} variant={variant} size={size} plus={false}>
      {(close) => (
        <RenewalForm
          mode="renew"
          action={renewRenewal}
          types={types}
          renewal={renewal}
          askOdometer={askOdometer}
          onDone={() => {
            close();
            onDone?.();
          }}
        />
      )}
    </SheetButton>
  );
}

/** A renewal with no scan yet: the record's own upload form in a sheet; the hub names the file from the renewal (C134). */
export function AddScanSheet({ renewalId, renewalType, vehicleName, nameHint }: { renewalId: string; renewalType: string; vehicleName: string; nameHint: string }) {
  return (
    <SheetButton label="Add the scan" title={`Add the ${renewalType.toLowerCase()} scan`} crumb={`/ ${vehicleName} / ${renewalType}`} size="sm">
      {(close) => <UploadForm owner={{ ownerType: "vehicle_renewal", ownerId: renewalId }} nameHint={nameHint} onDone={close} />}
    </SheetButton>
  );
}

export function AddOdometerSheet({ vehicleId, vehicleName, defaultDate }: { vehicleId: string; vehicleName: string; defaultDate: string }) {
  return (
    <SheetButton label="Add km" title="Odometer reading" crumb={`/ ${vehicleName} / Odometer`} description="With the date you read it, so an old number is never mistaken for today's.">
      {(close) => <OdometerForm action={addOdometerReading} vehicleId={vehicleId} defaultDate={defaultDate} onDone={close} />}
    </SheetButton>
  );
}

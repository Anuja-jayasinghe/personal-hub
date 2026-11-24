"use client";

import { SheetButton } from "@/components/shared/sheet-button";
import { UploadForm } from "@/components/shared/upload-form";
import { OdometerForm } from "@/components/vehicles/odometer-form";
import { RenewalForm } from "@/components/vehicles/renewal-form";
import { ServiceForm } from "@/components/vehicles/service-form";
import type { VehicleRenewal, VehicleService } from "@/db/schema";
import { addOdometerReading } from "@/features/vehicles/odometer-actions";
import { renewRenewal, updateRenewal } from "@/features/vehicles/renewal-actions";
import { updateService } from "@/features/vehicles/service-actions";

/**
 * The vehicle "add" forms as bottom sheets (R.5a; board HVehicleForms). Client wrappers, because a
 * sheet closes itself after saving and the tabs that show these buttons render on the server.
 */

/** "Add the invoice" on a service (V.1a, C147): the record's own upload form in a sheet; the hub names the file `PLATE_service_<date>`. */
export function AddInvoiceSheet({ serviceId, serviceLabel, vehicleName, nameHint }: { serviceId: string; serviceLabel: string; vehicleName: string; nameHint: string }) {
  return (
    <SheetButton label="Add the invoice" title="Add the invoice" crumb={`/ ${vehicleName} / ${serviceLabel}`} variant="ghost" size="sm">
      {(close) => <UploadForm owner={{ ownerType: "vehicle_service", ownerId: serviceId }} nameHint={nameHint} onDone={close} />}
    </SheetButton>
  );
}

/**
 * "Renew" from the Documents tab (issue #187): the renew form in a sheet, so the renewal
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

/** "Edit" in a detail sheet (V.2): the renewal's own edit form in a sheet on top of it. */
export function EditRenewalSheet({ renewal, vehicleName, types, askOdometer = true }: { renewal: VehicleRenewal; vehicleName: string; types: readonly string[]; askOdometer?: boolean }) {
  return (
    <SheetButton label="Edit" title={`Edit ${renewal.type.toLowerCase()}`} crumb={`/ ${vehicleName} / ${renewal.type}`} variant="outline" size="lg" plus={false}>
      {(close) => <RenewalForm mode="edit" action={updateRenewal} types={types} renewal={renewal} askOdometer={askOdometer} onDone={close} />}
    </SheetButton>
  );
}

/** "Edit" in a detail sheet (V.2): the service's own edit form in a sheet on top of it. */
export function EditServiceSheet({ service, vehicleName, serviceTypes }: { service: VehicleService; vehicleName: string; serviceTypes: readonly string[] }) {
  return (
    <SheetButton label="Edit" title={`Edit ${service.serviceType.toLowerCase()}`} crumb={`/ ${vehicleName} / Service`} variant="outline" size="lg" plus={false}>
      {(close) => <ServiceForm action={updateService} serviceTypes={serviceTypes} service={service} onDone={close} />}
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

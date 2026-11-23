"use client";

import { SheetButton } from "@/components/shared/sheet-button";
import { DocumentUploadForm } from "@/components/vehicles/document-forms";
import { OdometerForm } from "@/components/vehicles/odometer-form";
import { RenewalForm } from "@/components/vehicles/renewal-form";
import { ServiceForm } from "@/components/vehicles/service-form";
import { addOdometerReading } from "@/features/vehicles/odometer-actions";
import { createRenewal } from "@/features/vehicles/renewal-actions";
import { createService } from "@/features/vehicles/service-actions";

/**
 * The vehicle "add" forms as bottom sheets (R.5a; board HVehicleForms). Client wrappers, because a
 * sheet closes itself after saving and the tabs that show these buttons render on the server.
 */

export function AddRenewalSheet({ vehicleId, vehicleName, types, askOdometer = true }: { vehicleId: string; vehicleName: string; types: readonly string[]; askOdometer?: boolean }) {
  return (
    <SheetButton
      label="Add renewal"
      title="Add a renewal"
      crumb={`/ ${vehicleName} / New renewal`}
      description="Pick what it is and when it ends; you get a countdown and reminders before it lapses."
      variant="default"
    >
      {(close) => <RenewalForm mode="create" action={createRenewal} types={types} vehicleId={vehicleId} askOdometer={askOdometer} onDone={close} />}
    </SheetButton>
  );
}

export function AddServiceSheet({ vehicleId, vehicleName, serviceTypes, defaultDate }: { vehicleId: string; vehicleName: string; serviceTypes: readonly string[]; defaultDate: string }) {
  return (
    <SheetButton label="Add service" title="Add a service" crumb={`/ ${vehicleName} / New service`} variant="default">
      {(close) => <ServiceForm action={createService} serviceTypes={serviceTypes} vehicleId={vehicleId} defaultDate={defaultDate} onDone={close} />}
    </SheetButton>
  );
}

export function AddDocumentSheet({ vehicleId, vehicleName, namePrefix }: { vehicleId: string; vehicleName: string; namePrefix: string }) {
  return (
    <SheetButton
      label="Add document"
      title="Add a document"
      crumb={`/ ${vehicleName} / New document`}
      description="Name it so you can search for it, like Insurance 2026–2027. Images or PDF, up to 10 MB."
      variant="default"
    >
      {(close) => <DocumentUploadForm vehicleId={vehicleId} namePrefix={namePrefix} onDone={close} />}
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

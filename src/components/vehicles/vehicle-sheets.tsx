"use client";

import { SheetButton } from "@/components/shared/sheet-button";
import { UploadForm } from "@/components/shared/upload-form";
import { DocumentUploadForm } from "@/components/vehicles/document-forms";
import { OdometerForm } from "@/components/vehicles/odometer-form";
import { RenewalForm } from "@/components/vehicles/renewal-form";
import { ServiceForm } from "@/components/vehicles/service-form";
import type { VehicleRenewal } from "@/db/schema";
import { DOC_KINDS, type DocKind } from "@/features/vehicles/doc-names";
import { addOdometerReading } from "@/features/vehicles/odometer-actions";
import { createRenewal, renewRenewal } from "@/features/vehicles/renewal-actions";
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

export function AddDocumentSheet({
  vehicleId,
  vehicleName,
  namePrefix,
  kind,
  label = "Add document",
  variant = "default",
}: {
  vehicleId: string;
  vehicleName: string;
  namePrefix: string;
  /** Opened from a category on the Documents tab (issue #187): that kind is already chosen. */
  kind?: DocKind;
  label?: string;
  variant?: "default" | "outline";
}) {
  const kindLabel = DOC_KINDS.find((k) => k.key === kind)?.label;
  return (
    <SheetButton
      label={label}
      title={!kindLabel ? "Add a document" : kind === "other" ? "Add a paper" : `Add ${kind === "book" ? "the" : "a"} ${kindLabel.toLowerCase()}`}
      crumb={`/ ${vehicleName} / ${kindLabel ?? "New document"}`}
      description="Say what it is and its date; the hub names the file. Images or PDF, up to 10 MB."
      variant={variant}
      size={variant === "outline" ? "sm" : "default"}
    >
      {(close) => <DocumentUploadForm vehicleId={vehicleId} namePrefix={namePrefix} defaultKind={kind} onDone={close} />}
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

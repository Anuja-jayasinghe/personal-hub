"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendToStorage } from "@/components/shared/direct-upload";
import { labelClass, labelTextClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServiceFields, useOilMarker } from "@/components/vehicles/service-fields";
import type { VehicleService } from "@/db/schema";
import { uploadAttachment } from "@/features/shared/actions";
import { initialActionState, type ActionState } from "@/features/shared/types";
import type { OilRules } from "@/features/vehicles/service-logic";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  serviceTypes: readonly string[];
  /** Create: the vehicle the record belongs to. */
  vehicleId?: string;
  /** Edit: the record to change. */
  service?: VehicleService;
  /** Create: pre-filled service date ("YYYY-MM-DD"), usually today in the app time zone. */
  defaultDate?: string;
  /**
   * Create: the oil-change rule in force (V.1a, C147). For a type in its list the form shows the "Next oil
   * change" card instead of the plain next-due field. Editing never shows the card: it never recomputes a date.
   */
  oil?: OilRules;
  /** Create: whether this person may attach the invoice (Add in Vehicle documents); shows the optional file field. */
  canAttach?: boolean;
};

/** Create / edit form for a service record. Works with createService and updateService. */
export function ServiceForm({ action, serviceTypes, vehicleId, service, defaultDate, oil, canAttach = false, onDone }: Props & { onDone?: () => void }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const { formRef, onSubmit: keepValues } = useKeepValuesOnError(state);
  const listId = `service-types-${service?.id ?? "new"}`;

  const [serviceDate, setServiceDate] = useState(service?.serviceDate ?? defaultDate ?? "");
  const [serviceType, setServiceType] = useState(service?.serviceType ?? "");

  // The oil-change marker (create only).
  const marker = useOilMarker(serviceDate, serviceType, service ? undefined : oil);

  // The invoice: the file never goes to the server action (it would hit the request size limit); it goes
  // straight to storage once the service is saved, and is then recorded against the new service.
  const fileRef = useRef<HTMLInputElement>(null);
  const chosenFile = useRef<File | null>(null);
  const handled = useRef<ActionState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileProblem, setFileProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!state.ok || handled.current === state) return;
    handled.current = state;
    const file = chosenFile.current;
    chosenFile.current = null;
    if (service || !file || !state.id) {
      if (!service) formRef.current?.reset();
      onDone?.();
      return;
    }
    const serviceId = state.id;
    setUploading(true);
    (async () => {
      try {
        const sent = await sendToStorage(file, { purpose: "attachment", ownerType: "vehicle_service", ownerId: serviceId });
        const fd = new FormData();
        fd.set("ownerType", "vehicle_service");
        fd.set("ownerId", serviceId);
        fd.set("uploadedPath", sent.path);
        fd.set("fileName", sent.fileName);
        const recorded = await uploadAttachment(initialActionState, fd);
        if (!recorded.ok) throw new Error(recorded.error ?? "The invoice could not be saved.");
        onDone?.();
      } catch (err) {
        // The service itself is saved; say so, and leave "Add the invoice" on its row for another try.
        setFileProblem(err instanceof Error ? err.message : "The invoice did not upload.");
      } finally {
        setUploading(false);
      }
    })();
  }, [formRef, state, service, onDone]);

  const busy = uploading;
  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        chosenFile.current = fileRef.current?.files?.[0] ?? null;
        keepValues(e);
      }}
      className="flex flex-col gap-3"
    >
      {service ? <input type="hidden" name="id" value={service.id} /> : <input type="hidden" name="vehicleId" value={vehicleId} />}

      <ServiceFields
        serviceTypes={serviceTypes}
        listId={listId}
        serviceDate={serviceDate}
        onServiceDate={setServiceDate}
        serviceType={serviceType}
        onServiceType={setServiceType}
        service={service}
        marker={marker}
      />

      {canAttach && !service ? (
        <label className={labelClass}>
          <span className={labelTextClass}>The invoice (optional): a photo, scan or PDF, up to 10 MB</span>
          <Input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.heic" />
        </label>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {fileProblem ? (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-status-soon-mark/45 bg-status-soon-mark/10 p-3 text-sm">
          <p>
            <span className="font-medium">The service is saved, but the invoice was not.</span> {fileProblem} Use “Add the invoice” on the service to try again.
          </p>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => onDone?.()}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      {fileProblem ? null : service ? (
        <div>
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </div>
      ) : (
        <SubmitButton pendingLabel="Saving…" size="lg" className="w-full" disabled={busy}>
          {busy ? "Uploading the invoice…" : "Save service"}
        </SubmitButton>
      )}
    </form>
  );
}

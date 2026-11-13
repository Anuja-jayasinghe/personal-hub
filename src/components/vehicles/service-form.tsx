"use client";

import { useActionState, useEffect, useRef } from "react";
import { labelClass, labelTextClass, textareaClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import type { VehicleService } from "@/db/schema";
import { initialActionState, type ActionState } from "@/features/shared/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  serviceTypes: readonly string[];
  /** Create: the vehicle the record belongs to. */
  vehicleId?: string;
  /** Edit: the record to change. */
  service?: VehicleService;
  /** Create: pre-filled service date ("YYYY-MM-DD"), usually today in the app time zone. */
  defaultDate?: string;
};

/** Create / edit form for a service record. Works with createService and updateService. */
export function ServiceForm({ action, serviceTypes, vehicleId, service, defaultDate }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const listId = `service-types-${service?.id ?? "new"}`;

  useEffect(() => {
    if (state.ok && !service) formRef.current?.reset();
  }, [state, service]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {service ? <input type="hidden" name="id" value={service.id} /> : <input type="hidden" name="vehicleId" value={vehicleId} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Service date</span>
          <Input type="date" name="serviceDate" required defaultValue={service?.serviceDate ?? defaultDate} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Type</span>
          <Input name="serviceType" required maxLength={60} list={listId} defaultValue={service?.serviceType} placeholder="Pick or type, e.g. Oil change" />
          <datalist id={listId}>
            {serviceTypes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          <span className={labelTextClass}>Garage (optional)</span>
          <Input name="garage" maxLength={100} defaultValue={service?.garage ?? ""} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Cost (optional)</span>
          <Input name="cost" inputMode="decimal" defaultValue={service?.cost ?? ""} placeholder="0.00" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Odometer km (optional)</span>
          <Input name="odometerKm" inputMode="numeric" defaultValue={service?.odometerKm ?? ""} placeholder="45200" />
        </label>
      </div>

      <label className={labelClass}>
        <span className={labelTextClass}>Items done (optional)</span>
        <textarea name="itemsDone" maxLength={5000} defaultValue={service?.itemsDone ?? ""} className={textareaClass} />
      </label>

      <label className={labelClass}>
        <span className={labelTextClass}>Next due date (optional): you get reminded as it gets close</span>
        <Input type="date" name="nextDueDate" defaultValue={service?.nextDueDate ?? ""} className="max-w-48" />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div>
        <SubmitButton pendingLabel="Saving…">{service ? "Save changes" : "Add service"}</SubmitButton>
      </div>
    </form>
  );
}

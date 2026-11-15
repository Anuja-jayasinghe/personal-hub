"use client";

import Link from "next/link";
import { useActionState } from "react";
import { labelClass, labelTextClass, selectClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Vehicle } from "@/db/schema";
import { initialActionState, type ActionState } from "@/features/shared/types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fuelTypes: readonly string[];
  /** Pass an existing vehicle to edit it. */
  vehicle?: Vehicle;
};

/** Add / edit form for a vehicle. On success the Server Action redirects to the vehicle's page. */
export function VehicleForm({ action, fuelTypes, vehicle }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const { formRef, onSubmit } = useKeepValuesOnError(state);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      {vehicle ? <input type="hidden" name="id" value={vehicle.id} /> : null}

      <label className={labelClass}>
        <span className={labelTextClass}>Nickname</span>
        <Input name="nickname" required maxLength={60} defaultValue={vehicle?.nickname} placeholder="e.g. Corolla" />
      </label>

      <label className={labelClass}>
        <span className={labelTextClass}>Registration number (optional)</span>
        <Input name="registrationNumber" maxLength={20} defaultValue={vehicle?.registrationNumber ?? ""} placeholder="e.g. CAB 1234" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Make (optional)</span>
          <Input name="make" maxLength={60} defaultValue={vehicle?.make ?? ""} placeholder="e.g. Toyota" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Model (optional)</span>
          <Input name="model" maxLength={60} defaultValue={vehicle?.model ?? ""} placeholder="e.g. Corolla" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          <span className={labelTextClass}>Year</span>
          <Input name="year" inputMode="numeric" maxLength={4} defaultValue={vehicle?.year ?? ""} placeholder="2018" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Fuel</span>
          <select name="fuelType" defaultValue={vehicle?.fuelType ?? ""} className={selectClass}>
            <option value="">—</option>
            {fuelTypes.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        {vehicle ? null : (
          <label className={labelClass}>
            <span className={labelTextClass}>Odometer today (km)</span>
            <Input name="odometerKm" inputMode="numeric" placeholder="45200" />
          </label>
        )}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        {vehicle
          ? "Odometer readings, each with the date it was read, are on the vehicle's Overview page."
          : "Optional. It is saved as a reading dated today; add later readings on the vehicle's Overview page. Nothing reminds you by distance."}
      </p>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Saving…">{vehicle ? "Save changes" : "Add vehicle"}</SubmitButton>
        <Link href={vehicle ? `/vehicles/${vehicle.id}` : "/vehicles"} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

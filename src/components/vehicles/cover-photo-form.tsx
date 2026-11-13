"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { setVehicleCover } from "@/features/vehicles/actions";
import { initialActionState } from "@/features/shared/types";

/** Upload or replace the vehicle's cover photo (JPEG, PNG or WebP, up to 10 MB). */
export function CoverPhotoForm({ vehicleId, hasCover }: { vehicleId: string; hasCover: boolean }) {
  const [state, formAction] = useActionState(setVehicleCover, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="flex flex-wrap items-center gap-2">
        <Input type="file" name="file" required accept="image/jpeg,image/png,image/webp" className="max-w-xs" />
        <SubmitButton variant="outline" pendingLabel="Uploading…">
          {hasCover ? "Replace photo" : "Add photo"}
        </SubmitButton>
      </div>
      <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 10 MB.</p>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

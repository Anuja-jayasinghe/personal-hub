"use client";

import { useActionState, useEffect, useRef } from "react";
import { useDirectUpload } from "@/components/shared/direct-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setVehicleCover } from "@/features/vehicles/actions";
import { initialActionState } from "@/features/shared/types";

/** Upload or replace the vehicle's cover photo (JPEG, PNG or WebP, up to 10 MB). */
export function CoverPhotoForm({ vehicleId, hasCover }: { vehicleId: string; hasCover: boolean }) {
  const [state, formAction, saving] = useActionState(setVehicleCover, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  // The photo goes straight to storage first (C115), then the action records it.
  const { onSubmit, error, sending } = useDirectUpload(formAction, () => ({ purpose: "cover", ownerType: "vehicle", ownerId: vehicleId }));

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const shown = error ?? state.error;
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="flex flex-wrap items-center gap-2">
        <Input type="file" name="file" required accept="image/jpeg,image/png,image/webp" className="max-w-xs" />
        <Button type="submit" variant="outline" disabled={sending || saving}>
          {sending || saving ? "Uploading…" : hasCover ? "Replace photo" : "Add photo"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 10 MB.</p>
      {shown ? (
        <p role="alert" className="text-sm text-destructive">
          {shown}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { useDirectUpload } from "@/components/shared/direct-upload";
import { Button } from "@/components/ui/button";
import { labelClass, labelTextClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Input } from "@/components/ui/input";
import { renameVehicleDocument, uploadVehicleDocument } from "@/features/vehicles/document-actions";
import { DOC_TITLE_MAX } from "@/features/vehicles/documents";
import { initialActionState } from "@/features/shared/types";

/** Add a document: a required short title plus an image or PDF (up to 10 MB), sent straight to storage (C115). */
export function DocumentUploadForm({ vehicleId, onDone }: { vehicleId: string; onDone?: () => void }) {
  const [state, formAction, saving] = useActionState(uploadVehicleDocument, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const { onSubmit, error, sending } = useDirectUpload(formAction, () => ({ purpose: "document", ownerType: "vehicle", ownerId: vehicleId }));

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    onDone?.();
  }, [state, onDone]);

  const shown = error ?? state.error;
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Title</span>
          <Input name="title" required maxLength={DOC_TITLE_MAX} placeholder="e.g. Insurance 2026-2027" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>File (image or PDF, up to 10 MB)</span>
          <Input type="file" name="file" required accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.heic" />
        </label>
      </div>
      {shown ? (
        <p role="alert" className="text-sm text-destructive">
          {shown}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={sending || saving}>
        {sending || saving ? "Uploading…" : "Save document"}
      </Button>
    </form>
  );
}

/** Change a document's title. */
export function DocumentRenameForm({ id, title }: { id: string; title: string }) {
  const [state, formAction] = useActionState(renameVehicleDocument, initialActionState);
  const { formRef, onSubmit } = useKeepValuesOnError(state);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-2">
        <Input name="title" required maxLength={DOC_TITLE_MAX} defaultValue={title} className="max-w-xs" aria-label="Title" />
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save title
        </SubmitButton>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

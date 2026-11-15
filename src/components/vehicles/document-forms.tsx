"use client";

import { useActionState, useEffect } from "react";
import { labelClass, labelTextClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Input } from "@/components/ui/input";
import { renameVehicleDocument, uploadVehicleDocument } from "@/features/vehicles/document-actions";
import { DOC_TITLE_MAX } from "@/features/vehicles/documents";
import { initialActionState } from "@/features/shared/types";

/** Add a document: a required short title plus an image or PDF (up to 10 MB). */
export function DocumentUploadForm({ vehicleId }: { vehicleId: string }) {
  const [state, formAction] = useActionState(uploadVehicleDocument, initialActionState);
  const { formRef, onSubmit } = useKeepValuesOnError(state);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [formRef, state]);

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Title</span>
          <Input name="title" required maxLength={DOC_TITLE_MAX} placeholder="e.g. Insurance 2026-2027" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>File (image or PDF, up to 10 MB)</span>
          <Input
            type="file"
            name="file"
            required
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.heic"
          />
        </label>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div>
        <SubmitButton pendingLabel="Uploading…">Add document</SubmitButton>
      </div>
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

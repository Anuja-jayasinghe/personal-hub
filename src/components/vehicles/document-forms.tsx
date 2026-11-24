"use client";

import { useActionState, useEffect } from "react";
import { useDirectUpload } from "@/components/shared/direct-upload";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Input } from "@/components/ui/input";
import { renameVehicleDocument, replaceVehicleFile } from "@/features/vehicles/document-actions";
import { DOC_TITLE_MAX } from "@/features/vehicles/documents";
import { initialActionState } from "@/features/shared/types";

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

/**
 * Replace a paper's file (issue #187): pick the new image or PDF; it keeps the old file's name and title,
 * and the old file is removed once the new one is saved. Same upload as the record's own form (C115).
 */
export function ReplaceFileForm({ id, owner, onDone }: { id: string; owner: { ownerType: "vehicle" | "vehicle_renewal"; ownerId: string }; onDone?: () => void }) {
  const [state, formAction, saving] = useActionState(replaceVehicleFile, initialActionState);
  const { onSubmit, error, sending } = useDirectUpload(formAction, () => ({ purpose: "attachment", ...owner }));

  useEffect(() => {
    if (state.ok && !state.notice) onDone?.();
  }, [state, onDone]);

  // Replaced, but the old file is still there: say so, and offer no second replace (it would add a third file).
  if (state.ok && state.notice) {
    return (
      <p role="status" className="text-sm text-status-soon">
        {state.notice}
      </p>
    );
  }
  const shown = error ?? state.error;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <Input type="file" name="file" required aria-label="New file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.heic" />
      <Button type="submit" variant="outline" size="sm" disabled={sending || saving}>
        {sending || saving ? "Replacing…" : "Replace file"}
      </Button>
      {shown ? (
        <p role="alert" className="text-sm text-destructive">
          {shown}
        </p>
      ) : null}
    </form>
  );
}

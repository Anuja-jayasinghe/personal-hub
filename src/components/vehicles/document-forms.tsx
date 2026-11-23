"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useDirectUpload } from "@/components/shared/direct-upload";
import { Button } from "@/components/ui/button";
import { labelClass, labelTextClass, selectClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Input } from "@/components/ui/input";
import { renameVehicleDocument, replaceVehicleFile, uploadVehicleDocument } from "@/features/vehicles/document-actions";
import { DOC_KINDS, defaultDocTitle, docFileName, documentKind, extensionFor, type DocKind } from "@/features/vehicles/doc-names";
import { DOC_TITLE_MAX } from "@/features/vehicles/documents";
import { initialActionState } from "@/features/shared/types";

/**
 * Add a document (issue #179): what it is and its date are asked, because they name the file
 * (`PLATE_type_date.pdf`, shown before saving); the title is optional. The file goes straight to storage (C115).
 * Opened from a category on the Documents tab, the kind is already chosen (issue #187).
 */
export function DocumentUploadForm({ vehicleId, namePrefix, defaultKind, onDone }: { vehicleId: string; namePrefix: string; defaultKind?: DocKind; onDone?: () => void }) {
  const [state, formAction, saving] = useActionState(uploadVehicleDocument, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<DocKind | "">(defaultKind ?? "");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [ext, setExt] = useState("pdf");
  const { onSubmit, error, sending } = useDirectUpload(formAction, (fd) => ({
    purpose: "document",
    ownerType: "vehicle",
    ownerId: vehicleId,
    doc: { kind: String(fd.get("kind") ?? ""), date: String(fd.get("date") ?? ""), title: String(fd.get("title") ?? "") },
  }));

  useEffect(() => {
    if (!state.ok) return;
    // The sheet closes (and the form unmounts) on success, which also clears the kind, date and title.
    formRef.current?.reset();
    onDone?.();
  }, [state, onDone]);

  const chosen = DOC_KINDS.find((k) => k.key === kind);
  const preview = kind && date ? docFileName({ vehicle: namePrefix, kind: documentKind(kind, title), date, ext }) : null;
  const shown = error ?? state.error;
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>What is it?</span>
          <select name="kind" required value={kind} onChange={(e) => setKind(e.target.value as DocKind | "")} className={selectClass}>
            <option value="" disabled>
              Choose…
            </option>
            {DOC_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>{chosen?.dateLabel ?? "Date"}</span>
          <Input type="date" name="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>{kind === "other" ? "What is it called?" : "Title (optional)"}</span>
          <Input
            name="title"
            required={kind === "other"}
            maxLength={DOC_TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "other" ? "e.g. Service invoice" : kind && date ? defaultDocTitle(kind, date) : "Made from what it is"}
          />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>File (image or PDF, up to 10 MB)</span>
          <Input
            type="file"
            name="file"
            required
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.heic"
            onChange={(e) => setExt(fileExt(e.target.files?.[0]))}
          />
        </label>
      </div>
      {preview ? (
        <p className="font-mono text-xs break-all text-muted-foreground">
          Saved as <span className="text-foreground">{preview}</span>
        </p>
      ) : null}
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

/** The preview's extension from the picked file's type (the server decides the real one from what arrives). */
function fileExt(file: File | undefined): string {
  if (!file) return "pdf";
  return extensionFor(file.type || (/\.heic$/i.test(file.name) ? "image/heic" : ""));
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

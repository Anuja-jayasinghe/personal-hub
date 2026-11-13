"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { uploadAttachment } from "@/features/shared/actions";
import { initialActionState } from "@/features/shared/types";
import type { OwnerRef } from "@/lib/owners";

/** Small upload form: pick an image or PDF (up to 10 MB) and attach it to `owner`. */
export function UploadForm({ owner }: { owner: OwnerRef }) {
  const [state, formAction] = useActionState(uploadAttachment, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="ownerType" value={owner.ownerType} />
      <input type="hidden" name="ownerId" value={owner.ownerId} />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="file"
          name="file"
          required
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.heic"
          className="max-w-xs"
        />
        <SubmitButton variant="outline" pendingLabel="Uploading…">
          Upload
        </SubmitButton>
      </div>
      <p className="text-xs text-muted-foreground">Images or PDF, up to 10 MB.</p>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

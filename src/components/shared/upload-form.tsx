"use client";

import { useActionState, useEffect, useRef } from "react";
import { useDirectUpload } from "@/components/shared/direct-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadAttachment } from "@/features/shared/actions";
import { initialActionState } from "@/features/shared/types";
import type { OwnerRef } from "@/lib/owners";

/** Small upload form: pick an image or PDF (up to 10 MB) and attach it to `owner`. It goes straight to storage (C115). */
export function UploadForm({ owner }: { owner: OwnerRef }) {
  const [state, formAction, saving] = useActionState(uploadAttachment, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const { onSubmit, error, sending } = useDirectUpload(formAction, () => ({ purpose: "attachment", ...owner }));

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const shown = error ?? state.error;
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="ownerType" value={owner.ownerType} />
      <input type="hidden" name="ownerId" value={owner.ownerId} />
      <div className="flex flex-wrap items-center gap-2">
        <Input type="file" name="file" required accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.heic" className="max-w-xs" />
        <Button type="submit" variant="outline" disabled={sending || saving}>
          {sending || saving ? "Uploading…" : "Upload"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Images or PDF, up to 10 MB.</p>
      {shown ? (
        <p role="alert" className="text-sm text-destructive">
          {shown}
        </p>
      ) : null}
    </form>
  );
}

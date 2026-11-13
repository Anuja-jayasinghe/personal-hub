"use client";

import { useActionState, useEffect, useRef } from "react";
import { labelClass, labelTextClass, textareaClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import type { Note } from "@/db/schema";
import { initialActionState, type ActionState } from "@/features/shared/types";
import type { OwnerRef } from "@/lib/owners";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  owner?: OwnerRef | null;
  note?: Note;
};

/** Create / edit form for a note. Works with the createNote and updateNote Server Actions. */
export function NoteForm({ action, owner, note }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && !note) formRef.current?.reset();
  }, [state, note]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {note ? <input type="hidden" name="id" value={note.id} /> : null}
      {!note && owner ? (
        <>
          <input type="hidden" name="ownerType" value={owner.ownerType} />
          <input type="hidden" name="ownerId" value={owner.ownerId} />
        </>
      ) : null}

      <label className={labelClass}>
        <span className={labelTextClass}>Title (optional)</span>
        <Input name="title" maxLength={200} defaultValue={note?.title ?? ""} />
      </label>
      <label className={labelClass}>
        <span className={labelTextClass}>Note</span>
        <textarea name="body" required maxLength={20000} defaultValue={note?.body} className={textareaClass} />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div>
        <SubmitButton pendingLabel="Saving…">{note ? "Save changes" : "Add note"}</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { labelClass, labelTextClass, selectClass, textareaClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import type { Task } from "@/db/schema";
import { initialActionState, type ActionState } from "@/features/shared/types";
import type { OwnerRef } from "@/lib/owners";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Owner of a new task; leave out for a standalone task. Ignored when editing. */
  owner?: OwnerRef | null;
  /** Pass an existing task to edit it. */
  task?: Task;
  onDone?: () => void;
};

/** Create / edit form for a task. Works with the createTask and updateTask Server Actions. */
export function TaskForm({ action, owner, task, onDone }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (!task) formRef.current?.reset();
      onDone?.();
    }
  }, [state, task, onDone]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      {!task && owner ? (
        <>
          <input type="hidden" name="ownerType" value={owner.ownerType} />
          <input type="hidden" name="ownerId" value={owner.ownerId} />
        </>
      ) : null}

      <label className={labelClass}>
        <span className={labelTextClass}>Title</span>
        <Input name="title" required maxLength={200} defaultValue={task?.title} placeholder="What needs doing?" />
      </label>

      <label className={labelClass}>
        <span className={labelTextClass}>Details (optional)</span>
        <textarea name="details" maxLength={5000} defaultValue={task?.details ?? ""} className={textareaClass} />
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className={labelClass}>
          <span className={labelTextClass}>Priority</span>
          <select name="priority" defaultValue={task?.priority ?? "normal"} className={selectClass}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Due date</span>
          <Input type="date" name="dueDate" defaultValue={task?.dueDate ?? ""} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Estimated cost</span>
          <Input name="estimatedCost" inputMode="decimal" defaultValue={task?.estimatedCost ?? ""} placeholder="0.00" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Actual cost</span>
          <Input name="actualCost" inputMode="decimal" defaultValue={task?.actualCost ?? ""} placeholder="0.00" />
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div>
        <SubmitButton pendingLabel="Saving…">{task ? "Save changes" : "Add task"}</SubmitButton>
      </div>
    </form>
  );
}

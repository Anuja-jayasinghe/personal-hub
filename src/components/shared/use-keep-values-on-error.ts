"use client";

import { useEffect, useRef } from "react";
import type { ActionState } from "@/features/shared/types";
import { restoreValues, type FormField } from "./restore-values";

/**
 * Keeps what was typed when a form's Server Action returns an error. Use the returned `formRef`
 * and `onSubmit` on the form, and pass the state from `useActionState`:
 *
 *   const [state, formAction] = useActionState(action, initialActionState);
 *   const { formRef, onSubmit } = useKeepValuesOnError(state);
 *   <form ref={formRef} action={formAction} onSubmit={onSubmit}>
 *
 * On success nothing is restored, so a form that should clear after saving still does.
 */
export function useKeepValuesOnError(state: ActionState) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<FormData | null>(null);

  useEffect(() => {
    const form = formRef.current;
    const data = submitted.current;
    if (!state.error || !form || !data) return;
    restoreValues(form.elements as unknown as ArrayLike<FormField>, data);
  }, [state]);

  return {
    formRef,
    // Runs when the form is submitted, before the action: remembers the values React is about to reset.
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => {
      submitted.current = new FormData(e.currentTarget);
    },
  };
}

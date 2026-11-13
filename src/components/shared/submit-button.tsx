"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = Omit<React.ComponentProps<typeof Button>, "type"> & {
  /** Shown while the form is submitting. */
  pendingLabel?: string;
  /** If set, the browser asks this question first and the form is only submitted on OK. */
  confirm?: string;
};

/** Submit button that disables itself while its form is submitting, with optional confirm prompt. */
export function SubmitButton({ children, pendingLabel, confirm, onClick, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || props.disabled}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...props}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

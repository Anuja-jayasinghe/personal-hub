"use client";

import { SignOutButton } from "@clerk/nextjs";

/** The red-text Sign out button at the bottom of the More page. */
export function SignOutRow() {
  return (
    <SignOutButton>
      <button
        type="button"
        className="flex min-h-12 items-center justify-center rounded-xl border text-sm font-semibold text-destructive outline-none hover:bg-status-overdue-soft focus-visible:ring-2 focus-visible:ring-ring"
      >
        Sign out
      </button>
    </SignOutButton>
  );
}

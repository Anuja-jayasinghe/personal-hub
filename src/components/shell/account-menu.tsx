"use client";

import { Show, UserButton } from "@clerk/nextjs";

/** The signed-in person's menu (profile, sign out), at the bottom of the desktop rail. */
export function AccountMenu() {
  return (
    <Show when="signed-in">
      <UserButton />
    </Show>
  );
}

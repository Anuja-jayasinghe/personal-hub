"use client";

import { Show, UserButton } from "@clerk/nextjs";

/** The signed-in person's menu (profile, sign out), at the top right of every page header (S.1). */
export function AccountMenu() {
  return (
    <Show when="signed-in">
      <UserButton />
    </Show>
  );
}

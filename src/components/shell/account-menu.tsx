"use client";

import { Show, UserButton } from "@clerk/nextjs";

/** The signed-in person's menu (profile, sign out) in the sidebar footer. */
export function AccountMenu() {
  return (
    <Show when="signed-in">
      <div className="flex items-center gap-2 px-2 py-1 text-sm">
        <UserButton />
        <span className="text-muted-foreground">Account</span>
      </div>
    </Show>
  );
}

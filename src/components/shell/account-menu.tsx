"use client";

import { Show, UserButton } from "@clerk/nextjs";
import { Bell } from "lucide-react";

/**
 * The signed-in person's menu (profile, sign out), at the top right of every page header (S.1). With
 * `notifications` it also has a "Notifications" link to their own page (N.5, C144): only people the hub
 * lets in (owners and active people) get it, so the server decides and passes it down; the page checks
 * the person again.
 */
export function AccountMenu({ notifications = false }: { notifications?: boolean }) {
  return (
    <Show when="signed-in">
      {notifications ? (
        <UserButton>
          <UserButton.MenuItems>
            <UserButton.Link label="Notifications" labelIcon={<Bell size={16} />} href="/notifications" />
          </UserButton.MenuItems>
        </UserButton>
      ) : (
        <UserButton />
      )}
    </Show>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { SheetBody } from "@/components/shared/sheet-button";
import { Sheet } from "@/components/ui/sheet";

/**
 * The detail sheet of a renewal or a service (V.2, C149), addressed by `?item=` so a link can open it. The page
 * renders it already open when the address names one of this vehicle's records; closing it (the close button,
 * Escape, a tap outside, or an action that makes the record go away) takes the `item` part out of the address
 * and keeps the rest (the tab, the search). A bottom sheet on a phone and a window on a wide screen, like every
 * other sheet here.
 */

const CloseContext = createContext<() => void>(() => {});

/** Closes the sheet this is inside, for actions that end it (a delete, a renew). */
export const useCloseItemSheet = () => useContext(CloseContext);

export function ItemSheetShell({ title, crumb, closeHref, children }: { title: string; crumb: string; closeHref: string; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const close = useCallback(() => {
    setOpen(false);
    router.replace(closeHref, { scroll: false });
  }, [router, closeHref]);

  return (
    <CloseContext value={close}>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <SheetBody title={title} crumb={crumb} close={close}>
          {children}
        </SheetBody>
      </Sheet>
    </CloseContext>
  );
}

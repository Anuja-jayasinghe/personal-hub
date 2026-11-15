"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The two small buttons on a meter card (C75, C76).
 *
 * "+ Reading" opens the quick add-a-reading form right under the buttons.
 *
 * "Actions" opens a floating card attached to the button, above everything else, holding the less
 * common actions (add a bill, mark paid, history, edit, archive…). It opens when the pointer rests
 * on the button and stays open while the pointer moves from the button into the card; clicking the
 * button (or using anything inside the card) keeps it open until you click outside, press Escape
 * or click the button again. From the keyboard, Enter or Space on the button opens it and moves
 * focus into the card, Escape closes it and returns focus to the button. The panels are rendered
 * by the server and passed in.
 */
export function CardPanels({ reading, actions }: { reading?: ReactNode; actions: ReactNode }) {
  const [readingOpen, setReadingOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  // Once the button was clicked or the card used, moving the pointer away must not close it.
  const pinned = useRef(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {reading ? (
          <Button type="button" variant="outline" size="sm" aria-expanded={readingOpen} onClick={() => setReadingOpen((v) => !v)}>
            <Plus aria-hidden /> Reading
          </Button>
        ) : null}

        <Popover
          open={actionsOpen}
          onOpenChange={(next, details) => {
            if (next) {
              setActionsOpen(true);
              return;
            }
            if (pinned.current && details.reason === "trigger-hover") return; // pointer left, but it was pinned
            pinned.current = false;
            setActionsOpen(false);
          }}
        >
          <PopoverTrigger
            openOnHover
            delay={120}
            closeDelay={300}
            onClick={() => {
              pinned.current = true;
            }}
            render={<Button type="button" variant="ghost" size="sm" />}
          >
            Actions <ChevronDown aria-hidden />
          </PopoverTrigger>
          <PopoverContent
            aria-label="Meter actions"
            onPointerDownCapture={() => {
              pinned.current = true;
            }}
            onFocusCapture={() => {
              pinned.current = true;
            }}
            className="@container"
          >
            <div className="flex flex-col gap-2">{actions}</div>
          </PopoverContent>
        </Popover>
      </div>
      {readingOpen && reading ? <div className="rounded-md border p-3">{reading}</div> : null}
    </div>
  );
}

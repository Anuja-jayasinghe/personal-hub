"use client";

import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Panel = "reading" | "actions";

/**
 * The two small buttons on a meter card. One opens the quick "add a reading" form, the other a
 * list of the less common actions (add a bill, mark paid, history, edit, archive…). Only one panel
 * is open at a time, and both start closed so the card stays a clean summary. The panels are
 * rendered by the server and passed in.
 */
export function CardPanels({ reading, actions }: { reading?: ReactNode; actions: ReactNode }) {
  const [open, setOpen] = useState<Panel | null>(null);
  const toggle = (p: Panel) => setOpen((cur) => (cur === p ? null : p));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {reading ? (
          <Button type="button" variant="outline" size="sm" aria-expanded={open === "reading"} onClick={() => toggle("reading")}>
            <Plus aria-hidden /> Reading
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="sm" aria-expanded={open === "actions"} onClick={() => toggle("actions")}>
          Actions {open === "actions" ? "▴" : "▾"}
        </Button>
      </div>
      {open === "reading" && reading ? <div className="rounded-md border p-3">{reading}</div> : null}
      {open === "actions" ? <div className="flex flex-col gap-2">{actions}</div> : null}
    </div>
  );
}

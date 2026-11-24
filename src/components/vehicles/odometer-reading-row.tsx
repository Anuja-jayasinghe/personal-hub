"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { OdometerForm } from "@/components/vehicles/odometer-form";
import type { VehicleOdometerReading } from "@/db/schema";
import { deleteOdometerReading, updateOdometerReading } from "@/features/vehicles/odometer-actions";

/**
 * One row of the odometer history (issue #237). The row's own content arrives as `children`, drawn on the server.
 * For a reading the signed-in person may change (`reading` is given), two quiet icon buttons sit at the end of the
 * row: a pencil that opens the same edit form as before, in place under the row (and closes it after saving), and
 * the delete with its confirm. Service and emission values have no buttons here: they are edited in their own
 * sheet. This replaces the full-width "Edit" bar under each row.
 */
export function OdometerReadingRow({ reading, dateLabel, spare = false, children }: { reading?: VehicleOdometerReading; dateLabel: string; /** A row with no buttons keeps their room, so the km of every row line up. */ spare?: boolean; children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="px-2.5 py-2 md:px-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        {reading ? (
          <div className="-my-1 flex shrink-0 items-center">
            <Button
              type="button"
              variant="ghost"
              className="size-11 text-muted-foreground md:size-9"
              aria-label={`Edit the reading from ${dateLabel}`}
              aria-expanded={editing}
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil aria-hidden />
            </Button>
            <form action={deleteOdometerReading}>
              <input type="hidden" name="id" value={reading.id} />
              <SubmitButton variant="ghost" className="size-11 text-muted-foreground hover:text-status-overdue md:size-9" aria-label={`Delete the reading from ${dateLabel}`} confirm="Delete this odometer reading?">
                <Trash2 aria-hidden />
              </SubmitButton>
            </form>
          </div>
        ) : spare ? (
          <span aria-hidden className="w-20 shrink-0 md:w-[4.5rem]" />
        ) : null}
      </div>
      {reading && editing ? (
        <div className="mt-2 rounded-xl border bg-background/60 p-3">
          <OdometerForm action={updateOdometerReading} reading={reading} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </li>
  );
}

"use client";

import { SheetButton, SheetPanel } from "@/components/shared/sheet-button";
import { PaperForm } from "@/components/vehicles/paper-form";
import { kindsFor, type PaperContext, type PaperKind } from "@/features/vehicles/paper-flow";

/**
 * The one flow for adding a paper (V.1b, C148) in a sheet: a bottom sheet on a phone, a window in the middle of the
 * screen on a wide one, like every other add form. `kind` presets the chip (the Documents tab's categories).
 */

const DESCRIPTION = "The file, what it is and its dates. The hub makes the record and names the file.";

/** True when this person can add any of these kinds, so a button that opens the sheet is worth showing. */
function canAddAny(ctx: PaperContext, kind?: PaperKind): boolean {
  const offered = kindsFor(ctx.can);
  return kind ? offered.some((k) => k.key === kind) : offered.length > 0;
}

/** A button that opens the sheet. Nothing at all when the person may not add what it is for. */
export function AddPaperButton({
  ctx,
  kind,
  label = "Add a paper",
  title = "Add a paper",
  variant = "default",
  plus = true,
}: {
  ctx: PaperContext;
  kind?: PaperKind;
  label?: string;
  title?: string;
  variant?: "default" | "outline" | "ghost";
  plus?: boolean;
}) {
  if (!canAddAny(ctx, kind)) return null;
  return (
    <SheetButton
      label={label}
      title={title}
      crumb={`/ ${ctx.vehicleName} / New paper`}
      description={DESCRIPTION}
      variant={variant}
      size={variant === "default" ? "default" : "sm"}
      plus={plus && variant !== "ghost"}
    >
      {(close) => <PaperForm ctx={ctx} kind={kind} onDone={close} />}
    </SheetButton>
  );
}

/** The sheet without a button of its own: the vehicle's Add menu opens it when "A paper" is chosen. */
export function PaperPanel({ ctx, open, onOpenChange }: { ctx: PaperContext; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <SheetPanel open={open} onOpenChange={onOpenChange} title="Add a paper" crumb={`/ ${ctx.vehicleName} / New paper`} description={DESCRIPTION}>
      {(close) => <PaperForm ctx={ctx} onDone={close} />}
    </SheetPanel>
  );
}

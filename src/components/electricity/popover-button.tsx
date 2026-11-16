"use client";

import { ChevronDown, MoreHorizontal, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { createBill, addReading } from "@/features/electricity/actions";
import { BillForm } from "@/components/electricity/bill-form";
import { BothReadingsForm, type MeterForEntry } from "@/components/electricity/both-readings-form";
import { ReadingForm } from "@/components/electricity/reading-form";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * A button that opens a small floating card attached to it (C78). Click to open; a click outside,
 * Escape or the button again closes it, and focus goes back to the button. `children` may be a
 * function that receives `close`, for forms that should close the card after saving.
 */
export function PopoverButton({
  label,
  ariaLabel,
  variant = "outline",
  icon,
  align = "start",
  children,
}: {
  label?: string;
  ariaLabel?: string;
  variant?: "outline" | "ghost" | "default";
  icon?: "plus" | "more" | "chevron";
  align?: "start" | "end";
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant={variant} size={label ? "sm" : "icon-sm"} aria-label={ariaLabel} />}>
        {icon === "plus" ? <Plus aria-hidden /> : null}
        {label}
        {icon === "more" ? <MoreHorizontal aria-hidden /> : null}
        {icon === "chevron" ? <ChevronDown aria-hidden /> : null}
      </PopoverTrigger>
      <PopoverContent align={align} aria-label={ariaLabel ?? label} className="@container">
        {typeof children === "function" ? children(close) : children}
      </PopoverContent>
    </Popover>
  );
}

/** "+ Add reading": a card with the reading form that closes itself after saving. */
export function AddReadingButton({ meterId, defaultDate }: { meterId: string; defaultDate: string }) {
  return (
    <PopoverButton label="Add reading" icon="plus">
      {(close) => (
        <div className="p-1">
          <ReadingForm action={addReading} meterId={meterId} defaultDate={defaultDate} onDone={close} />
        </div>
      )}
    </PopoverButton>
  );
}

/** "+ Add bill": the bill form in a card; the previous reading comes from the last bill (C73). */
export function AddBillButton({
  meterId,
  defaultDate,
  defaultPrevious,
  previousDate,
}: {
  meterId: string;
  defaultDate: string;
  defaultPrevious?: string;
  previousDate?: string;
}) {
  return (
    <PopoverButton label="Add bill" icon="plus">
      {(close) => (
        <div className="p-1">
          <BillForm action={createBill} meterId={meterId} defaultDate={defaultDate} defaultPrevious={defaultPrevious} previousDate={previousDate} onDone={close} />
        </div>
      )}
    </PopoverButton>
  );
}

/** "Add readings": both meters' readings in one card (2b.1), closing itself after saving. The primary action of the page. */
export function AddBothReadingsButton({ meters, defaultDate }: { meters: MeterForEntry[]; defaultDate: string }) {
  return (
    <PopoverButton label="Add readings" icon="plus" variant="default" align="end">
      {(close) => (
        <div className="p-1">
          <BothReadingsForm meters={meters} defaultDate={defaultDate} onDone={close} />
        </div>
      )}
    </PopoverButton>
  );
}

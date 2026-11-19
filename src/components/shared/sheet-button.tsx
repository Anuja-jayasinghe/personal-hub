"use client";

import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * A button that opens a bottom sheet (DESIGN.md, Sheets; boards HAddReadings, HBillForms): a grab
 * handle, a blue mono breadcrumb, the title in Oxanium, a close button, then the form. On a wide
 * screen it opens as a larger window in the middle of the screen instead of a strip at the bottom
 * (S.1, owner's list item 6). `children` may be a function that receives `close`, for
 * forms that should close the sheet after saving.
 */
export function SheetButton({
  label,
  title,
  crumb,
  description,
  variant = "outline",
  size = "default",
  plus = true,
  children,
}: {
  label: string;
  title: string;
  /** The breadcrumb above the title, e.g. "/ Electricity / New reading". */
  crumb: string;
  description?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  plus?: boolean;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button type="button" variant={variant} size={size} />}>
        {plus ? <Plus aria-hidden /> : null}
        {label}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92svh] w-full max-w-xl gap-0 overflow-y-auto rounded-t-[28px] border-x-0 border-t border-border bg-card px-4 pt-2.5 pb-[calc(1.75rem+env(safe-area-inset-bottom))] md:my-auto md:max-h-[86svh] md:max-w-2xl md:rounded-[28px] md:border md:px-8 md:pt-7 md:pb-8 md:data-[side=bottom]:top-0 md:data-[side=bottom]:h-fit md:data-[side=bottom]:bottom-0"
      >
        <span aria-hidden className="mx-auto mb-3 block h-[5px] w-10 rounded-full bg-border md:hidden" />
        <p className="font-mono text-[10.5px] tracking-[0.14em] text-primary uppercase">{crumb}</p>
        <SheetTitle className="mt-0.5 pr-10 font-display text-[26px] leading-tight font-semibold tracking-tight">{title}</SheetTitle>
        {description ? <SheetDescription className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</SheetDescription> : null}
        <div className="@container mt-4">{typeof children === "function" ? children(close) : children}</div>
      </SheetContent>
    </Sheet>
  );
}

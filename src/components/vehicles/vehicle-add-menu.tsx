"use client";

import { FileText, Gauge, Plus, StickyNote, Wrench } from "lucide-react";
import { useState, type ReactNode } from "react";
import { NoteForm } from "@/components/shared/note-form";
import { SheetBody, SheetPanel } from "@/components/shared/sheet-button";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { OdometerForm } from "@/components/vehicles/odometer-form";
import { PaperPanel } from "@/components/vehicles/paper-sheet";
import { ServiceForm } from "@/components/vehicles/service-form";
import { createNote } from "@/features/shared/actions";
import type { AddChoices } from "@/features/vehicles/add-menu";
import { addOdometerReading } from "@/features/vehicles/odometer-actions";
import { createService } from "@/features/vehicles/service-actions";
import type { PaperContext } from "@/features/vehicles/paper-flow";
import type { OilRules } from "@/features/vehicles/service-logic";

type Choice = "paper" | "service" | "reading" | "note";

/** The choices in the order the owner-approved design shows them: the most common first is the paper, then the rest. */
const OPTIONS: { key: Choice; title: string; hint: string; icon: ReactNode; tile: string }[] = [
  {
    key: "paper",
    title: "A paper",
    hint: "License, insurance, emission test, book or an invoice.",
    icon: <FileText aria-hidden className="size-[22px]" />,
    tile: "bg-primary/15 text-primary",
  },
  {
    key: "service",
    title: "A service",
    hint: "Oil change, repairs. Add its invoice if you have one.",
    icon: <Wrench aria-hidden className="size-[22px]" />,
    tile: "bg-status-soon-mark/15 text-status-soon",
  },
  {
    key: "reading",
    title: "An odometer reading",
    hint: "Today's km, with the date you read it.",
    icon: <Gauge aria-hidden className="size-[22px]" />,
    tile: "bg-status-ok/15 text-status-ok",
  },
  {
    key: "note",
    title: "A note",
    hint: "Anything worth remembering.",
    icon: <StickyNote aria-hidden className="size-[22px]" />,
    tile: "bg-muted text-muted-foreground",
  },
];

/** The choices this person may use, one button each; picking one hands over to the parent, which opens its form. */
function ChoiceList({ choices, onPick }: { choices: AddChoices; onPick: (pick: Choice) => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {OPTIONS.filter((o) => choices[o.key]).map((o) => (
        <li key={o.key}>
          <button
            type="button"
            onClick={() => onPick(o.key)}
            className="flex min-h-16 w-full items-center gap-3.5 rounded-2xl border bg-card p-3 text-left outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${o.tile}`}>
              {o.icon}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-semibold">{o.title}</span>
              <span className="text-[12.5px] leading-snug text-muted-foreground">{o.hint}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const TRIGGER = "h-[46px] flex-1 rounded-[14px] px-5 text-[15px] font-semibold md:h-[42px] md:flex-none md:rounded-xl md:text-sm";

/**
 * The one Add button on a vehicle's page (V.1a, C147; the owner-approved design), next to Manage. "What
 * happened?": a paper, a service, an odometer reading or a note, each shown only if the signed-in person may do
 * it (`addChoices`, worked out on the server; this component only receives plain booleans). On a phone it is a
 * bottom sheet, on a wide screen a popover under the button. Picking a choice opens that form in the same sheet
 * every other add form uses. The button is not shown at all when there is nothing to add.
 */
export function VehicleAddMenu({
  vehicleId,
  vehicleName,
  paper,
  choices,
  serviceTypes,
  defaultDate,
  oil,
}: {
  vehicleId: string;
  vehicleName: string;
  /** What the one flow for papers needs (V.1b): the vehicle, what the person may do, and what to prefill. */
  paper: PaperContext;
  choices: AddChoices;
  serviceTypes: readonly string[];
  /** Today, "YYYY-MM-DD" in the app time zone. */
  defaultDate: string;
  oil: OilRules;
}) {
  // Two menus (a phone sheet and a desktop popover) sit in the page and CSS shows one; each has its own open state.
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [wideOpen, setWideOpen] = useState(false);
  const [form, setForm] = useState<Choice | null>(null);

  const pick = (p: Choice) => {
    setPhoneOpen(false);
    setWideOpen(false);
    setForm(p);
  };
  const closeForm = () => setForm(null);
  const crumb = `/ ${vehicleName} / Add`;

  return (
    <>
      <div className="contents md:hidden">
        <Sheet open={phoneOpen} onOpenChange={setPhoneOpen}>
          <SheetTrigger render={<Button type="button" className={TRIGGER} />}>
            <Plus aria-hidden className="size-4" />
            Add
          </SheetTrigger>
          <SheetBody title="What happened?" crumb={crumb} close={() => setPhoneOpen(false)}>
            <ChoiceList choices={choices} onPick={pick} />
          </SheetBody>
        </Sheet>
      </div>
      <div className="hidden md:contents">
        <Popover open={wideOpen} onOpenChange={setWideOpen}>
          <PopoverTrigger render={<Button type="button" className={TRIGGER} />}>
            <Plus aria-hidden className="size-4" />
            Add
          </PopoverTrigger>
          <PopoverContent align="end" aria-label="What happened?">
            <div className="flex flex-col gap-2 p-1">
              <p className="px-1 pt-1 font-display text-lg font-semibold">What happened?</p>
              <ChoiceList choices={choices} onPick={pick} />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {choices.paper ? <PaperPanel ctx={paper} open={form === "paper"} onOpenChange={(o) => (o ? setForm("paper") : closeForm())} /> : null}
      {choices.service ? (
        <SheetPanel open={form === "service"} onOpenChange={(o) => (o ? setForm("service") : closeForm())} title="Add a service" crumb={`/ ${vehicleName} / New service`}>
          {(close) => (
            <ServiceForm action={createService} serviceTypes={serviceTypes} vehicleId={vehicleId} defaultDate={defaultDate} oil={oil} canAttach={paper.can.files} onDone={close} />
          )}
        </SheetPanel>
      ) : null}
      {choices.reading ? (
        <SheetPanel
          open={form === "reading"}
          onOpenChange={(o) => (o ? setForm("reading") : closeForm())}
          title="Odometer reading"
          crumb={`/ ${vehicleName} / Odometer`}
          description="With the date you read it, so an old number is never mistaken for today's."
        >
          {(close) => <OdometerForm action={addOdometerReading} vehicleId={vehicleId} defaultDate={defaultDate} onDone={close} />}
        </SheetPanel>
      ) : null}
      {choices.note ? (
        <SheetPanel open={form === "note"} onOpenChange={(o) => (o ? setForm("note") : closeForm())} title="Add a note" crumb={`/ ${vehicleName} / New note`}>
          {(close) => <NoteForm action={createNote} owner={{ ownerType: "vehicle", ownerId: vehicleId }} onDone={close} />}
        </SheetPanel>
      ) : null}
    </>
  );
}

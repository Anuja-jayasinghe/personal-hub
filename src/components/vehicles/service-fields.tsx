"use client";

import { useState } from "react";
import { labelClass, labelTextClass, textareaClass } from "@/components/shared/form-styles";
import { Input } from "@/components/ui/input";
import type { VehicleService } from "@/db/schema";
import { oilChangeMarker, oilChangeWords, type OilRules } from "@/features/vehicles/service-logic";
import { formatDate } from "@/lib/format";

/**
 * The fields of a service and the "Next oil change" card (V.1a, C147), shared by the Add a service form and the one
 * flow for papers (V.1b), so a service is asked for in one way everywhere. The caller owns the form around it.
 */

/** The state of the oil-change marker for the service being typed: its date, the "Remind me" switch and a changed date. */
export function useOilMarker(serviceDate: string, serviceType: string, oil: OilRules | undefined) {
  const marker = oil ? oilChangeMarker(serviceDate, serviceType, oil) : null;
  const [remind, setRemind] = useState(true);
  const [changing, setChanging] = useState(false);
  const [custom, setCustom] = useState("");
  /** The date the card shows (and the form sends while the switch is on), or null when this type sets no marker. */
  const date = marker ? custom || marker : null;
  return { oil, date, remind, setRemind, changing, startChanging: () => setChanging(true), custom, setCustom };
}
export type OilMarker = ReturnType<typeof useOilMarker>;

export function ServiceFields({
  serviceTypes,
  listId,
  serviceDate,
  onServiceDate,
  serviceType,
  onServiceType,
  service,
  marker,
}: {
  serviceTypes: readonly string[];
  listId: string;
  serviceDate: string;
  onServiceDate: (date: string) => void;
  serviceType: string;
  onServiceType: (type: string) => void;
  /** Edit: the record being changed (no marker card then: editing never recomputes a date). */
  service?: VehicleService;
  marker: OilMarker;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Service date</span>
          <Input type="date" name="serviceDate" required value={serviceDate} onChange={(e) => onServiceDate(e.target.value)} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Type</span>
          <Input
            name="serviceType"
            required
            maxLength={60}
            list={listId}
            value={serviceType}
            onChange={(e) => onServiceType(e.target.value)}
            placeholder="Pick or type, e.g. Oil change"
          />
          <datalist id={listId}>
            {serviceTypes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          <span className={labelTextClass}>Garage (optional)</span>
          <Input name="garage" maxLength={100} defaultValue={service?.garage ?? ""} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Cost (optional)</span>
          <Input name="cost" inputMode="decimal" defaultValue={service?.cost ?? ""} placeholder="0.00" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Odometer at service, km (optional)</span>
          <Input name="odometerKm" inputMode="numeric" defaultValue={service?.odometerKm ?? ""} placeholder="45200" />
        </label>
      </div>

      <label className={labelClass}>
        <span className={labelTextClass}>Items done (optional)</span>
        <textarea name="itemsDone" maxLength={5000} defaultValue={service?.itemsDone ?? ""} className={textareaClass} />
      </label>

      {!service && marker.oil && marker.date ? (
        <OilMarkerCard marker={marker} min={serviceDate} />
      ) : (
        <label className={labelClass}>
          <span className={labelTextClass}>Next due date (optional): you get reminded as it gets close</span>
          <Input type="date" name="nextDueDate" defaultValue={service?.nextDueDate ?? ""} className="max-w-48" />
        </label>
      )}
    </>
  );
}

/**
 * "Next oil change" (V.1a, C147; the owner-approved design): the date is the service date plus the rule's
 * months, a "Remind me" switch (on by default; off sends no date at all), and a quiet "Change the date". The
 * date is stored in the service's own next-due field, so reminders, Home and notifications follow it with
 * nothing else to change. The km half is only a glance: it is shown beside the date in words (C24).
 */
function OilMarkerCard({ marker, min }: { marker: OilMarker; min: string }) {
  const { oil, date, remind, setRemind, changing, startChanging, custom, setCustom } = marker;
  if (!oil || !date) return null;
  return (
    <section aria-label="Next oil change" className="flex flex-col gap-2.5 rounded-2xl border border-dashed border-status-soon-mark/50 bg-status-soon-mark/10 p-4">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-mono text-[10.5px] tracking-[0.14em] text-status-soon uppercase">Next oil change</span>
          <span className="text-base font-semibold">{remind ? `By ${formatDate(date)}` : "No reminder"}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={remind}
          aria-label="Remind me"
          onClick={() => setRemind(!remind)}
          className={`flex h-[30px] w-[52px] shrink-0 items-center rounded-full p-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            remind ? "justify-end bg-status-soon-mark" : "justify-start bg-border"
          }`}
        >
          <span className="size-6 rounded-full bg-background shadow-sm" />
        </button>
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        {oilChangeWords(oil)}.{" "}
        {remind && !changing ? (
          <button type="button" onClick={startChanging} className="rounded-sm font-medium text-status-soon underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            Change the date
          </button>
        ) : null}
      </p>
      {remind && changing ? (
        <label className={labelClass}>
          <span className={labelTextClass}>Remind me on</span>
          <Input type="date" min={min} value={custom || date} onChange={(e) => setCustom(e.target.value)} className="max-w-48" />
        </label>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {remind ? "If you service earlier, the new service moves this date. You are told before it and on the day." : "Nothing will remind you about the next oil change."}
      </p>
      {/* What the server receives: the date only while the switch is on; the switch itself so it can tell "off" from "blank". */}
      <input type="hidden" name="nextDueDate" value={remind ? date : ""} />
      <input type="hidden" name="markerRemind" value={remind ? "on" : "off"} />
    </section>
  );
}

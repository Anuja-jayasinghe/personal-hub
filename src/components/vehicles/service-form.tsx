"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendToStorage } from "@/components/shared/direct-upload";
import { labelClass, labelTextClass, textareaClass } from "@/components/shared/form-styles";
import { SubmitButton } from "@/components/shared/submit-button";
import { useKeepValuesOnError } from "@/components/shared/use-keep-values-on-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VehicleService } from "@/db/schema";
import { uploadAttachment } from "@/features/shared/actions";
import { initialActionState, type ActionState } from "@/features/shared/types";
import { oilChangeMarker, oilChangeWords, type OilRules } from "@/features/vehicles/service-logic";
import { formatDate } from "@/lib/format";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  serviceTypes: readonly string[];
  /** Create: the vehicle the record belongs to. */
  vehicleId?: string;
  /** Edit: the record to change. */
  service?: VehicleService;
  /** Create: pre-filled service date ("YYYY-MM-DD"), usually today in the app time zone. */
  defaultDate?: string;
  /**
   * Create: the oil-change rule in force (V.1a, C147). For a type in its list the form shows the "Next oil
   * change" card instead of the plain next-due field. Editing never shows the card: it never recomputes a date.
   */
  oil?: OilRules;
  /** Create: whether this person may attach the invoice (Add in Vehicle documents); shows the optional file field. */
  canAttach?: boolean;
};

/** Create / edit form for a service record. Works with createService and updateService. */
export function ServiceForm({ action, serviceTypes, vehicleId, service, defaultDate, oil, canAttach = false, onDone }: Props & { onDone?: () => void }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const { formRef, onSubmit: keepValues } = useKeepValuesOnError(state);
  const listId = `service-types-${service?.id ?? "new"}`;

  const [serviceDate, setServiceDate] = useState(service?.serviceDate ?? defaultDate ?? "");
  const [serviceType, setServiceType] = useState(service?.serviceType ?? "");

  // The oil-change marker (create only).
  const marker = !service && oil ? oilChangeMarker(serviceDate, serviceType, oil) : null;
  const [remind, setRemind] = useState(true);
  const [changing, setChanging] = useState(false);
  const [custom, setCustom] = useState("");
  const markerDate = marker ? (custom || marker) : null;

  // The invoice: the file never goes to the server action (it would hit the request size limit); it goes
  // straight to storage once the service is saved, and is then recorded against the new service.
  const fileRef = useRef<HTMLInputElement>(null);
  const chosenFile = useRef<File | null>(null);
  const handled = useRef<ActionState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileProblem, setFileProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!state.ok || handled.current === state) return;
    handled.current = state;
    const file = chosenFile.current;
    chosenFile.current = null;
    if (service || !file || !state.id) {
      if (!service) formRef.current?.reset();
      onDone?.();
      return;
    }
    const serviceId = state.id;
    setUploading(true);
    (async () => {
      try {
        const sent = await sendToStorage(file, { purpose: "attachment", ownerType: "vehicle_service", ownerId: serviceId });
        const fd = new FormData();
        fd.set("ownerType", "vehicle_service");
        fd.set("ownerId", serviceId);
        fd.set("uploadedPath", sent.path);
        fd.set("fileName", sent.fileName);
        const recorded = await uploadAttachment(initialActionState, fd);
        if (!recorded.ok) throw new Error(recorded.error ?? "The invoice could not be saved.");
        onDone?.();
      } catch (err) {
        // The service itself is saved; say so, and leave "Add the invoice" on its row for another try.
        setFileProblem(err instanceof Error ? err.message : "The invoice did not upload.");
      } finally {
        setUploading(false);
      }
    })();
  }, [formRef, state, service, onDone]);

  const busy = uploading;
  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        chosenFile.current = fileRef.current?.files?.[0] ?? null;
        keepValues(e);
      }}
      className="flex flex-col gap-3"
    >
      {service ? <input type="hidden" name="id" value={service.id} /> : <input type="hidden" name="vehicleId" value={vehicleId} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Service date</span>
          <Input type="date" name="serviceDate" required value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Type</span>
          <Input
            name="serviceType"
            required
            maxLength={60}
            list={listId}
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
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

      {oil && markerDate ? (
        <OilMarkerCard
          oil={oil}
          date={markerDate}
          remind={remind}
          onRemind={setRemind}
          changing={changing}
          onChange={() => setChanging(true)}
          custom={custom}
          onCustom={setCustom}
          min={serviceDate}
        />
      ) : (
        <label className={labelClass}>
          <span className={labelTextClass}>Next due date (optional): you get reminded as it gets close</span>
          <Input type="date" name="nextDueDate" defaultValue={service?.nextDueDate ?? ""} className="max-w-48" />
        </label>
      )}

      {canAttach && !service ? (
        <label className={labelClass}>
          <span className={labelTextClass}>The invoice (optional): a photo, scan or PDF, up to 10 MB</span>
          <Input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.heic" />
        </label>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {fileProblem ? (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-status-soon-mark/45 bg-status-soon-mark/10 p-3 text-sm">
          <p>
            <span className="font-medium">The service is saved, but the invoice was not.</span> {fileProblem} Use “Add the invoice” on the service to try again.
          </p>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => onDone?.()}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      {fileProblem ? null : service ? (
        <div>
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </div>
      ) : (
        <SubmitButton pendingLabel="Saving…" size="lg" className="w-full" disabled={busy}>
          {busy ? "Uploading the invoice…" : "Save service"}
        </SubmitButton>
      )}
    </form>
  );
}

/**
 * "Next oil change" (V.1a, C147; the owner-approved design): the date is the service date plus the rule's
 * months, a "Remind me" switch (on by default; off sends no date at all), and a quiet "Change the date". The
 * date is stored in the service's own next-due field, so reminders, Home and notifications follow it with
 * nothing else to change. The km half is only a glance: it is shown beside the date in words (C24).
 */
function OilMarkerCard({
  oil,
  date,
  remind,
  onRemind,
  changing,
  onChange,
  custom,
  onCustom,
  min,
}: {
  oil: OilRules;
  date: string;
  remind: boolean;
  onRemind: (on: boolean) => void;
  changing: boolean;
  onChange: () => void;
  custom: string;
  onCustom: (date: string) => void;
  min: string;
}) {
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
          onClick={() => onRemind(!remind)}
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
          <button type="button" onClick={onChange} className="rounded-sm font-medium text-status-soon underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            Change the date
          </button>
        ) : null}
      </p>
      {remind && changing ? (
        <label className={labelClass}>
          <span className={labelTextClass}>Remind me on</span>
          <Input type="date" min={min} value={custom || date} onChange={(e) => onCustom(e.target.value)} className="max-w-48" />
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

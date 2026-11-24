"use client";

import { Camera, Check, FileText } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { putToStorage, typeOf } from "@/components/shared/direct-upload";
import { labelClass, labelTextClass } from "@/components/shared/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServiceFields, useOilMarker } from "@/components/vehicles/service-fields";
import { preparePaper, savePaper } from "@/features/vehicles/paper-actions";
import {
  accessLine,
  defaultFrom,
  defaultUntil,
  dayText,
  fileRequired,
  kindsFor,
  paperMode,
  previewName,
  saveLabel,
  savingLines,
  isRenewalKind,
  type PaperContext,
  type PaperInput,
  type PaperKind,
  type RenewalPaperKind,
} from "@/features/vehicles/paper-flow";
import { formatBytes } from "@/lib/format";

/**
 * The one flow for adding a paper (V.1b, C148; the owner-approved design): 1 the file, 2 what it is, 3 only the
 * fields that kind needs (filled in from the last record of that kind, never with an invented number), what the
 * file will be saved as, what saving does, and one Save that makes the record and puts the file on it, or
 * does nothing. What it offers follows what the person may do (`ctx.can`), but the server decides again.
 * Policy, license and certificate numbers are never asked for: they are on the scan (C137).
 */

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf,.heic";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

const COPY: Record<RenewalPaperKind, { provider: string; from: string; amount: string; noNumber: string; noun: string }> = {
  license: { provider: "Council or office (optional)", from: "Valid from", amount: "Amount paid (optional)", noNumber: "No license number to type: it is on the scan.", noun: "license" },
  insurance: { provider: "Insurer (optional)", from: "Valid from", amount: "Premium (optional)", noNumber: "No policy number to type: it is on the scan.", noun: "insurance" },
  emission: { provider: "Test centre (optional)", from: "Test date (valid from)", amount: "Fee (optional)", noNumber: "No certificate number to type: it is on the scan.", noun: "emission test" },
};

/** The values the form keeps itself (the ones other parts depend on); the rest are plain inputs read on submit. */
type Values = { provider: string; startDate: string; expiryDate: string; date: string; title: string; serviceDate: string; serviceType: string };
const EMPTY: Values = { provider: "", startDate: "", expiryDate: "", date: "", title: "", serviceDate: "", serviceType: "" };

function defaultsFor(kind: PaperKind, ctx: PaperContext): Values {
  if (isRenewalKind(kind)) {
    const p = ctx.prefill[kind];
    const from = defaultFrom(p, ctx.today);
    return { ...EMPTY, provider: p.provider ?? "", startDate: from, expiryDate: defaultUntil(from, p.spanMonths) ?? "" };
  }
  if (kind === "service") return { ...EMPTY, serviceDate: ctx.today };
  if (kind === "other") return { ...EMPTY, date: ctx.today };
  return { ...EMPTY };
}

export function PaperForm({ ctx, kind: preset, onDone }: { ctx: PaperContext; kind?: PaperKind; onDone?: () => void }) {
  const { can } = ctx;
  const offered = kindsFor(can);
  const start = preset && offered.some((k) => k.key === preset) ? preset : null;

  const [kind, setKind] = useState<PaperKind | null>(start);
  const [values, setValues] = useState<Values>(() => (start ? defaultsFor(start, ctx) : EMPTY));
  const [untilTouched, setUntilTouched] = useState(false);
  const set = (name: keyof Values, value: string) => setValues((v) => ({ ...v, [name]: value }));

  const [file, setFile] = useState<File | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const thumbRef = useRef<string | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  useEffect(() => () => void (thumbRef.current && URL.revokeObjectURL(thumbRef.current)), []);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState(false);
  const [hasOdometer, setHasOdometer] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const marker = useOilMarker(values.serviceDate, values.serviceType, ctx.oil);

  const mode = kind ? paperMode(kind, can) : null;
  const withFileStep = can.files;
  const required = kind ? fileRequired(kind, can) : false;

  const pick = (next: PaperKind) => {
    if (next === kind) return;
    setKind(next);
    setValues(defaultsFor(next, ctx));
    setUntilTouched(false);
    setHasOdometer(false);
    setError(null);
    setOffer(false);
  };

  const onFile = (picked: File | undefined) => {
    setError(null);
    setOffer(false);
    if (thumbRef.current) URL.revokeObjectURL(thumbRef.current);
    thumbRef.current = null;
    setThumb(null);
    if (!picked) {
      setFile(null);
      setFileProblem(null);
      return;
    }
    const type = typeOf(picked);
    if (!ALLOWED_TYPES.includes(type)) {
      setFile(null);
      setFileProblem("Only JPEG, PNG, WebP, HEIC images and PDF files are allowed.");
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      setFileProblem("File is too large. The limit is 10 MB.");
      return;
    }
    setFileProblem(null);
    setFile(picked);
    if (type.startsWith("image/") && type !== "image/heic") {
      thumbRef.current = URL.createObjectURL(picked);
      setThumb(thumbRef.current);
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement> | null, attach = false) => {
    e?.preventDefault();
    if (busy || !kind) return;
    if (required && !file) {
      setError("Choose a file to add.");
      return;
    }
    const form = formRef.current;
    if (!form) return;
    const fields: Record<string, string> = {};
    for (const [name, value] of new FormData(form).entries()) if (typeof value === "string") fields[name] = value;
    const input: PaperInput = { vehicleId: ctx.vehicleId, kind, fields, attach };
    setBusy(true);
    setError(null);
    setOffer(false);
    try {
      let result;
      if (file && can.files) {
        const mimeType = typeOf(file);
        const prepared = await preparePaper({ ...input, file: { fileName: file.name, mimeType, size: file.size } });
        if (!prepared.ok) {
          setError(prepared.error);
          setOffer(prepared.canAttach === true);
          return;
        }
        await putToStorage(prepared.signedUrl, file, mimeType);
        result = await savePaper({ ...input, upload: { path: prepared.path, ownerId: prepared.ownerId } });
      } else {
        result = await savePaper(input);
      }
      if (!result.ok) {
        setError(result.error);
        setOffer(result.canAttach === true);
        return;
      }
      onDone?.();
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith("The upload") ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // What the sheet tells the person: the name, and what saving does.
  const saved = file && kind ? previewName(kind, can, values, ctx.namePrefix, typeOf(file), ctx.today) : null;
  const prefill = kind && isRenewalKind(kind) ? ctx.prefill[kind] : null;
  const hasPrevious = !!(prefill?.lastExpiry && values.expiryDate && values.expiryDate > prefill.lastExpiry);
  const lines = kind
    ? savingLines(kind, can, { hasFile: !!file, hasPrevious, hasOdometer, markerDateText: kind === "service" && marker.remind && marker.date ? dayText(marker.date) : null })
    : [];
  const note = kind ? accessLine(kind, can) : null;
  const label = saveLabel(kind);

  let step = 0;
  const n = () => ++step;

  return (
    <form
      ref={formRef}
      onSubmit={(e) => void submit(e)}
      onInput={(e) => {
        if ((e.target as HTMLInputElement).name === "odometerKm") setHasOdometer((e.target as HTMLInputElement).value.trim() !== "");
      }}
      className="flex flex-col gap-5"
    >
      {withFileStep ? (
        <section aria-label="The file" className="flex flex-col gap-2.5">
          <span className="text-[13px] text-muted-foreground">
            {n()} · The file (photo, scan or PDF){kind && !required ? ", optional" : ""}
          </span>
          <input
            id="paper-file"
            type="file"
            aria-label="File"
            accept={ACCEPT}
            className="peer sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {file ? (
            <div className="flex items-center gap-3 rounded-2xl border bg-background p-2.5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              <span aria-hidden className="flex size-[58px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local preview of the picked file
                  <img src={thumb} alt="" className="size-full object-cover" />
                ) : (
                  <FileText className="size-6" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{file.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>
              </span>
              <label htmlFor="paper-file" className="cursor-pointer rounded-md px-2 py-1.5 text-sm font-semibold text-primary hover:underline">
                Change
              </label>
              {!required ? (
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById("paper-file") as HTMLInputElement | null;
                    if (input) input.value = "";
                    onFile(undefined);
                  }}
                  className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ) : (
            <label
              htmlFor="paper-file"
              className="flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border-strong px-4 py-4 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
            >
              <Camera aria-hidden className="size-[22px]" />
              Choose a photo, scan or PDF
            </label>
          )}
          {fileProblem ? (
            <p role="alert" className="text-sm text-destructive">
              {fileProblem}
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-label="What is it" className="flex flex-col gap-2.5">
        <span className="text-[13px] text-muted-foreground">{n()} · What is it?</span>
        <div role="group" aria-label="What is it" className="flex flex-wrap gap-2">
          {offered.map((k) => {
            const on = k.key === kind;
            return (
              <button
                key={k.key}
                type="button"
                aria-pressed={on}
                onClick={() => pick(k.key)}
                className={`h-10 pointer-coarse:h-11 rounded-full border px-3.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on ? "border-primary bg-accent font-semibold text-foreground" : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                }`}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </section>

      {kind && mode ? (
        <section aria-label="Its details" className="flex flex-col gap-3">
          <span className="text-[13px] text-muted-foreground">{n()} · Its details</span>
          <Details
            key={kind}
            kind={kind}
            mode={mode}
            ctx={ctx}
            values={values}
            set={set}
            untilTouched={untilTouched}
            touchUntil={() => setUntilTouched(true)}
            marker={marker}
          />
        </section>
      ) : null}

      {saved ? (
        <p className="font-mono text-[11px] break-all text-muted-foreground">
          Saved as <span className="text-foreground">{saved}</span>
        </p>
      ) : null}

      {kind ? (
        <section aria-label="What saving does" className="flex flex-col gap-2 rounded-2xl border bg-background px-4 py-3.5">
          <span className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">When you save</span>
          {lines.map((line) => (
            <span key={line} className="flex gap-2.5 text-[13px]">
              <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-status-ok" />
              {line}
            </span>
          ))}
          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
        </section>
      ) : null}

      {error ? (
        offer ? (
          <div role="alert" className="flex flex-col gap-2.5 rounded-xl border border-status-soon-mark/45 bg-status-soon-mark/10 p-3 text-sm">
            <p>{error}</p>
            <div>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void submit(null, true)}>
                Attach the file to it
              </Button>
            </div>
          </div>
        ) : (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={busy || !kind}>
        {busy ? (file && can.files ? "Uploading…" : "Saving…") : label}
      </Button>
    </form>
  );
}

/** The fields of one kind. Remounted (`key`) when the kind changes, so the plain inputs start empty again. */
function Details({
  kind,
  mode,
  ctx,
  values,
  set,
  untilTouched,
  touchUntil,
  marker,
}: {
  kind: PaperKind;
  mode: "record" | "document";
  ctx: PaperContext;
  values: Values;
  set: (name: keyof Values, value: string) => void;
  untilTouched: boolean;
  touchUntil: () => void;
  marker: ReturnType<typeof useOilMarker>;
}) {
  if (isRenewalKind(kind)) {
    const copy = COPY[kind];
    const p = ctx.prefill[kind];
    if (mode === "document") {
      return (
        <label className={labelClass}>
          <span className={labelTextClass}>Valid until</span>
          <Input type="date" name="expiryDate" required value={values.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className="max-w-48" />
        </label>
      );
    }
    const length = p.spanMonths && p.spanMonths !== 12 ? `${p.spanMonths} months later, like the last one` : "One year later";
    return (
      <>
        <label className={labelClass}>
          <span className={labelTextClass}>{copy.provider}</span>
          <Input name="provider" maxLength={100} value={values.provider} onChange={(e) => set("provider", e.target.value)} />
          {p.provider && values.provider === p.provider ? <Hint>Same as the last {copy.noun}</Hint> : null}
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className={labelClass}>
            <span className={labelTextClass}>{copy.from}</span>
            <Input
              type="date"
              name="startDate"
              required
              value={values.startDate}
              onChange={(e) => {
                const from = e.target.value;
                set("startDate", from);
                // Until follows from, unless it was typed: the same length as the last record, a year when there is none.
                if (!untilTouched) set("expiryDate", defaultUntil(from, p.spanMonths) ?? values.expiryDate);
              }}
            />
            <Hint>{p.lastExpiry && values.startDate === defaultFrom(p, ctx.today) ? "The day after the last one ended" : null}</Hint>
          </label>
          <label className={labelClass}>
            <span className={labelTextClass}>Valid until</span>
            <Input
              type="date"
              name="expiryDate"
              required
              value={values.expiryDate}
              onChange={(e) => {
                touchUntil();
                set("expiryDate", e.target.value);
              }}
            />
            <Hint>{!untilTouched ? length : null}</Hint>
          </label>
        </div>
        <label className={labelClass}>
          <span className={labelTextClass}>{copy.amount}</span>
          <Input name="amount" inputMode="decimal" placeholder="0.00" />
        </label>
        {kind === "emission" && ctx.askOdometer ? (
          <label className={labelClass}>
            <span className={labelTextClass}>Odometer on the test day (optional)</span>
            <Input name="odometerKm" inputMode="numeric" placeholder="42959" />
            <Hint>Printed on the certificate.</Hint>
          </label>
        ) : null}
        <p className="text-xs text-muted-foreground">{copy.noNumber}</p>
      </>
    );
  }

  if (kind === "service") {
    if (mode === "document") {
      return (
        <label className={labelClass}>
          <span className={labelTextClass}>Service date</span>
          <Input type="date" name="serviceDate" required value={values.serviceDate} onChange={(e) => set("serviceDate", e.target.value)} className="max-w-48" />
        </label>
      );
    }
    return (
      <ServiceFields
        serviceTypes={ctx.serviceTypes}
        listId="paper-service-types"
        serviceDate={values.serviceDate}
        onServiceDate={(d) => set("serviceDate", d)}
        serviceType={values.serviceType}
        onServiceType={(t) => set("serviceType", t)}
        marker={marker}
      />
    );
  }

  if (kind === "book") {
    return (
      <label className={labelClass}>
        <span className={labelTextClass}>Printed on (optional)</span>
        <Input type="date" name="date" value={values.date} onChange={(e) => set("date", e.target.value)} className="max-w-48" />
        <Hint>Left empty, today names the file.</Hint>
      </label>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={labelClass}>
        <span className={labelTextClass}>What is it called?</span>
        <Input name="title" required maxLength={100} value={values.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Service invoice" />
      </label>
      <label className={labelClass}>
        <span className={labelTextClass}>Date</span>
        <Input type="date" name="date" required value={values.date} onChange={(e) => set("date", e.target.value)} />
      </label>
    </div>
  );
}

function Hint({ children }: { children?: React.ReactNode }) {
  return children ? <span className="text-[11.5px] text-muted-foreground">{children}</span> : null;
}

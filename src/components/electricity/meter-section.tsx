import { Trash2 } from "lucide-react";
import { MeterForm } from "@/components/electricity/meter-form";
import { ReadingForm } from "@/components/electricity/reading-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import type { ElectricityMeter, ElectricityReading } from "@/db/schema";
import {
  addReading,
  archiveMeter,
  deleteMeter,
  deleteReading,
  unarchiveMeter,
  updateMeter,
  updateReading,
} from "@/features/electricity/actions";
import { formatKwh, sortReadings, toReading } from "@/features/electricity/usage";
import { toCents } from "@/lib/decimal";
import { formatDate } from "@/lib/format";

/** One meter: its latest reading, forms to add a reading or edit the meter, and the reading history. */
export function MeterSection({
  meter,
  readings,
  today,
}: {
  meter: ElectricityMeter;
  /** This meter's readings, newest first. */
  readings: ElectricityReading[];
  today: string;
}) {
  const sorted = sortReadings(readings.map((r) => ({ ...toReading(r), row: r })));
  const latest = sorted.at(-1);

  return (
    <li className="rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium">{meter.name}</h2>
            {meter.accountNumber ? <Badge variant="outline">Account {meter.accountNumber}</Badge> : null}
            {meter.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
          </div>
          <p className="mt-1 text-sm">
            {latest ? (
              <>
                Latest reading <span className="font-medium">{formatKwh(latest.value)}</span>
                <span className="text-muted-foreground"> on {formatDate(latest.date)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">No readings yet.</span>
            )}
          </p>
          {meter.notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{meter.notes}</p> : null}
        </div>
        <form action={meter.archivedAt ? unarchiveMeter : archiveMeter}>
          <input type="hidden" name="id" value={meter.id} />
          <SubmitButton variant="outline" size="sm" confirm={meter.archivedAt ? undefined : `Archive "${meter.name}"? Its readings are kept.`}>
            {meter.archivedAt ? "Unarchive" : "Archive"}
          </SubmitButton>
        </form>
        <form action={deleteMeter}>
          <input type="hidden" name="id" value={meter.id} />
          <SubmitButton variant="ghost" size="icon" aria-label={`Delete meter ${meter.name}`} confirm={`Permanently delete "${meter.name}" and all its readings? This cannot be undone.`}>
            <Trash2 aria-hidden />
          </SubmitButton>
        </form>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {!meter.archivedAt ? (
          <details className="rounded-md border border-primary/40">
            <summary className="cursor-pointer px-3 py-1.5 text-sm font-medium">Add a reading</summary>
            <div className="border-t p-3">
              <ReadingForm action={addReading} meterId={meter.id} defaultDate={today} />
            </div>
          </details>
        ) : null}

        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Reading history ({readings.length})</summary>
          {readings.length === 0 ? (
            <p className="border-t p-3 text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="flex flex-col divide-y border-t">
              {readings.map((r) => (
                <li key={r.id} className="p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium">{formatDate(r.readingDate)}</span>
                    <span>{formatKwh(toCents(r.value))}</span>
                    {r.replacedFinalValue !== null ? (
                      <Badge variant="secondary">Meter replaced · old meter ended at {formatKwh(toCents(r.replacedFinalValue))}</Badge>
                    ) : null}
                    {r.source === "auto" ? <Badge variant="outline">auto</Badge> : null}
                    {r.note ? <span className="text-muted-foreground">{r.note}</span> : null}
                    <form action={deleteReading} className="ml-auto">
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton variant="ghost" size="icon-sm" aria-label={`Delete reading from ${formatDate(r.readingDate)}`} confirm="Delete this reading?">
                        <Trash2 aria-hidden />
                      </SubmitButton>
                    </form>
                  </div>
                  <details className="mt-2 rounded-md border">
                    <summary className="cursor-pointer px-3 py-1 text-xs text-muted-foreground">Edit</summary>
                    <div className="border-t p-3">
                      <ReadingForm action={updateReading} reading={r} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </details>

        <details className="rounded-md border">
          <summary className="cursor-pointer px-3 py-1.5 text-sm text-muted-foreground">Edit meter</summary>
          <div className="border-t p-3">
            <MeterForm action={updateMeter} meter={meter} />
          </div>
        </details>
      </div>
    </li>
  );
}

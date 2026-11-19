import { MeterInstrument, type InstrumentMeter } from "@/components/electricity/meter-instrument";

export type BoardMeter = InstrumentMeter;

/**
 * The meter board (S.4, C109; design board "Electricity: the meter instrument"): one instrument per
 * meter, side by side. It replaces the GRID connector with its rectangles (R.3a) and the separate slab
 * lines, which showed the same numbers a second time. The live meter's frame is blue (#69).
 */
export function MeterBoard({ meters, low, high }: { meters: BoardMeter[]; low: number; high: number }) {
  const cols = Math.min(meters.length, 3);
  return (
    <section aria-label="The meters" className="grid gap-2.5 md:gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {meters.map((m) => (
        <MeterInstrument key={m.id} meter={m} low={low} high={high} />
      ))}
    </section>
  );
}

import Link from "next/link";
import { MeterBadge } from "@/components/electricity/meter-tone";
import type { ElectricityMeter } from "@/db/schema";

/**
 * The switcher at the top of the page (C78): Both, then one tab per meter. Plain links
 * (`?meter=<id>`), so the page stays server-rendered and a meter's view can be bookmarked.
 */
export function ElectricityTabs({
  meters,
  toneIndexOf,
  selectedId,
  showBoth,
  archived,
  basePath = "/electricity",
}: {
  meters: ElectricityMeter[];
  toneIndexOf: (id: string) => number;
  selectedId: string | null;
  showBoth: boolean;
  archived: boolean;
  basePath?: string;
}) {
  const base = archived ? `${basePath}?archived=1` : basePath;
  const join = archived ? "&" : "?";
  const item = (active: boolean) =>
    `flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-colors ${
      active ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <nav aria-label="Meters" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1">
      {showBoth ? (
        <Link href={base} aria-current={selectedId === null ? "page" : undefined} className={item(selectedId === null)}>
          Both
        </Link>
      ) : null}
      {meters.map((m) => (
        <Link
          key={m.id}
          href={`${base}${join}meter=${m.id}`}
          aria-current={selectedId === m.id ? "page" : undefined}
          className={item(selectedId === m.id)}
        >
          <MeterBadge name={m.name} index={toneIndexOf(m.id)} className="size-5 text-[11px]" />
          {m.name}
        </Link>
      ))}
    </nav>
  );
}

import Link from "next/link";
import { getIcon } from "@/components/shell/icons";
import { enabledModules, appConfig } from "@/config/app.config";
import type { AreaCount } from "@/features/home/home";

const meta = {
  vehicles: { label: "Vehicles", href: "/vehicles", icon: "car" },
  bills: { label: "Bills", href: "/bills", icon: "receipt" },
  tasks: { label: "Tasks", href: "/tasks", icon: "tasks" },
} as const;

/** Small tiles for the other areas (boards HHomePhone, HHome): how much each has due in the window, with its node icon. Only areas that are switched on. */
export function AreaTiles({ counts, windowDays, visible = () => true }: { counts: AreaCount[]; windowDays: number; visible?: (area: AreaCount["area"]) => boolean }) {
  const on = (area: AreaCount["area"]) =>
    area === "tasks" ? appConfig.sharedPages.some((p) => p.key === "tasks") : enabledModules.some((m) => m.key === area);
  // `visible`: only the parts this person may see (S.8, C114).
  const shown = counts.filter((c) => on(c.area) && visible(c.area));
  if (shown.length === 0) return null;

  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
      {shown.map((c) => {
        const m = meta[c.area];
        const Icon = getIcon(m.icon);
        return (
          <Link
            key={c.area}
            href={m.href}
            className="flex flex-col gap-1 rounded-2xl border bg-card p-3 outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring md:p-4"
          >
            <span className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg border bg-raised/70 text-muted-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
                <Icon className="size-[18px]" />
              </span>
              <span className="hidden font-mono text-[10px] tracking-[0.12em] text-label uppercase sm:inline">{m.label}</span>
            </span>
            <span className={`mt-1 font-display text-2xl leading-none font-semibold md:text-3xl ${c.overdue > 0 ? "text-status-overdue" : ""}`}>{c.due}</span>
            <span className="text-[11px] leading-snug text-muted-foreground">
              <span className="sm:hidden">{m.label}: </span>
              {c.due === 0 ? `nothing due in ${windowDays} days` : c.overdue > 0 ? `due, ${c.overdue} late` : `due in ${windowDays} days`}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

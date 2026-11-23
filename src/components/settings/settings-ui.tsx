import Link from "next/link";

/**
 * Building blocks of the Settings pages (R.6; boards HSettings, HSettingsMore): a section with a mono
 * label, a card of rows, a row that links on, and a read-only value in Oxanium.
 */

export const SETTINGS_PAGES = [
  { href: "/settings", label: "Settings", hint: "look, parts of the hub, the slab rule" },
  { href: "/settings/meters", label: "Meters and rules", hint: "your meters, 120 / 180, read every few days" },
  { href: "/settings/notifications", label: "Notifications", hint: "what the hub would tell you, and when" },
  { href: "/settings/backup", label: "Data and backup", hint: "backups, exports, files stored" },
  { href: "/settings/people", label: "People and roles", hint: "who can see and do what" },
] as const;

export function SettingsSection({ label, note, children }: { label: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-2.5">
      <h2 className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">{label}</h2>
      {children}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </section>
  );
}

/** Settings pages use the window width (issue #156): two columns from 1280px, one column below. */
export function SettingsColumns({ children }: { children: React.ReactNode }) {
  return <div className="grid min-w-0 gap-6 xl:grid-cols-2 xl:items-start xl:gap-x-9">{children}</div>;
}

/** One column of SettingsColumns. */
export function SettingsColumn({ children }: { children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-6">{children}</div>;
}

/** A card holding rows, each separated by a thin line. */
export function RowCard({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col divide-y divide-raised rounded-2xl border bg-card px-4">{children}</div>;
}

/** One row: a label with a hint underneath, and something on the right (a value, a state, an arrow). */
export function Row({
  label,
  hint,
  icon,
  end,
  href,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  end?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-3">
        <span className="text-[15px] font-semibold">{label}</span>
        {hint ? <span className="text-[12.5px] text-muted-foreground">{hint}</span> : null}
      </span>
      {end}
      {href ? (
        <span aria-hidden className="text-quiet">
          ›
        </span>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} className="flex min-h-14 items-center gap-3 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    <div className="flex min-h-14 items-center gap-3">{body}</div>
  );
}

/** A small mono tag on the right of a row ("2 METERS", "ON"). */
export function RowMeta({ children, tone = "label" }: { children: React.ReactNode; tone?: "label" | "blue" | "ok" | "quiet" }) {
  const colour = { label: "text-label", blue: "text-primary", ok: "text-status-ok", quiet: "text-quiet" }[tone];
  return <span className={`shrink-0 font-mono text-[10.5px] tracking-[0.12em] uppercase ${colour}`}>{children}</span>;
}

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { appConfig, enabledModules } from "@/config/app.config";
import { formatDate, formatMoney } from "@/lib/format";

/**
 * Temporary home page for step 0.4: shows that the name, logo, modules, currency and theme
 * tokens all come from config. It is replaced by the real dashboard in step 0.6.
 */
export default function Home() {
  const swatches = [
    ["Primary", "bg-primary"],
    ["Secondary", "bg-secondary"],
    ["Accent", "bg-accent"],
    ["Muted", "bg-muted"],
    ["Overdue", "bg-status-overdue"],
    ["Due soon", "bg-status-soon"],
    ["OK", "bg-status-ok"],
  ] as const;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="flex items-center gap-4">
        <Logo size={48} />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{appConfig.name}</h1>
          <p className="text-muted-foreground">{appConfig.tagline}</p>
        </div>
      </header>

      <section aria-labelledby="modules" className="flex flex-col gap-3">
        <h2 id="modules" className="text-lg font-medium">
          Modules
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {enabledModules.map((m) => (
            <li key={m.key} className="rounded-xl border bg-card p-4 text-card-foreground">
              <p className="font-medium">{m.label}</p>
              <p className="text-sm text-muted-foreground">{m.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="theme" className="flex flex-col gap-3">
        <h2 id="theme" className="text-lg font-medium">
          Theme check (placeholder branding)
        </h2>
        <div className="flex flex-wrap gap-2">
          {swatches.map(([label, cls]) => (
            <span
              key={label}
              className={`${cls} rounded-md border px-3 py-1.5 text-sm ${
                label === "Primary" ? "text-primary-foreground" : ""
              }`}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Sample amount: {formatMoney(12450.5)} · Sample date: {formatDate("2026-11-13")} · Time
          zone: {appConfig.timeZone}
        </p>
      </section>
    </main>
  );
}

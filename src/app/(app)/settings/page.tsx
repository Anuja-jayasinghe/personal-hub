import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ThemeSwitcher } from "@/components/shell/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appConfig } from "@/config/app.config";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  const summary: [string, React.ReactNode][] = [
    ["App name", appConfig.name],
    ["Currency", `${appConfig.currency.code} (${appConfig.currency.locale})`],
    ["Time zone", appConfig.timeZone],
    [
      "Reminder lead times",
      appConfig.reminders.leadDays.map((d) => (d === 0 ? "on the day" : `${d} days`)).join(", "),
    ],
    [
      "Modules",
      <span key="m" className="flex flex-wrap gap-1.5">
        {appConfig.modules.map((m) => (
          <Badge key={m.key} variant={m.enabled ? "default" : "outline"}>
            {m.label}
            {m.enabled ? "" : " (off)"}
          </Badge>
        ))}
      </span>,
    ],
  ];

  return (
    <>
      <PageHeader title="Settings" />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose light, dark, or follow this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>App configuration</CardTitle>
          <CardDescription>
            Read-only. These values live in <code className="font-mono">src/config/app.config.ts</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            {summary.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </>
  );
}

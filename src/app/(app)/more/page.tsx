import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountCard } from "@/components/shell/account-card";
import { getIcon } from "@/components/shell/icons";
import { morePageItems } from "@/components/shell/nav";
import { PageHeader } from "@/components/shell/page-header";
import { SignOutRow } from "@/components/shell/sign-out-row";

export const metadata: Metadata = { title: "More" };

const SettingsIcon = getIcon("settings");

/**
 * The phone's fifth tab (DESIGN.md, Navigation; board HMore): your account, the parts that do not fit
 * in the bar, Settings and sign out. Only pages that exist today are listed.
 */
export default function MorePage() {
  const items = morePageItems();
  const parts = items.filter((i) => i.key !== "settings");
  const settings = items.find((i) => i.key === "settings");

  return (
    <>
      <PageHeader title="More" />

      <Suspense fallback={<div className="h-[74px] rounded-xl border bg-card" />}>
        <AccountCard />
      </Suspense>

      <div className="grid grid-cols-2 gap-2.5">
        {parts.map((p) => {
          const Icon = getIcon(p.icon);
          return (
            <Link
              key={p.key}
              href={p.href}
              className="flex flex-col gap-3 rounded-xl border bg-card p-3.5 outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-10 items-center justify-center rounded-lg border bg-raised/70 text-muted-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur">
                <Icon className="size-5" />
              </span>
              <span className="text-[15px] font-semibold">{p.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col rounded-xl border bg-card px-3.5">
        {settings ? (
          <Link href={settings.href} className="flex min-h-13 items-center gap-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <SettingsIcon className="size-[18px] text-muted-foreground" />
            <span className="flex-1">Settings</span>
            <span aria-hidden className="text-quiet">›</span>
          </Link>
        ) : null}
      </div>

      <SignOutRow />
    </>
  );
}

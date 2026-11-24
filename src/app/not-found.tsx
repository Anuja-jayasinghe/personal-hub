import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { NotFoundNetwork } from "@/components/shell/state-pictures";
import { GoBackButton, RequestedPath } from "@/components/shell/state-links";
import { publicModules as enabledModules } from "@/config/app.config";

export const metadata: Metadata = { title: "Not found" };

const primary =
  "flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const secondary =
  "flex min-h-12 items-center justify-center rounded-xl border px-6 text-[15px] font-semibold outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring";

/**
 * 404 (R.6; boards HSystem, H404Desktop): "This page isn't connected to anything", the address that was
 * asked for, Go home, Go back, and links to the parts of the hub. It shows no data, so it needs no login.
 */
export default function NotFound() {
  return (
    <main
      className="flex flex-1 flex-col px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-16 lg:px-24"
      style={{ backgroundImage: "radial-gradient(60% 70% at 70% 45%, color-mix(in oklab, var(--primary) 9%, transparent) 0%, transparent 65%)" }}
    >
      <Link href="/" className="hit-44 self-start rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Logo size={34} />
      </Link>
      <div className="m-auto grid w-full max-w-6xl items-center gap-8 py-8 md:grid-cols-2 md:gap-10">
        <div className="flex flex-col">
          <span className="font-mono text-[11px] tracking-[0.14em] text-primary uppercase">/ 404 / Not found</span>
          <h1 className="mt-3 max-w-[12ch] font-display text-4xl leading-[1.02] font-semibold tracking-tight md:text-[3.5rem]">
            This page isn’t connected to anything.
          </h1>
          <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-muted-foreground md:text-[17px]">
            The link may be old, or the page moved. Everything else in the hub is where you left it.
          </p>
          <span className="mt-4 inline-flex min-h-8 max-w-full items-center self-start truncate rounded-lg border bg-card px-3 font-mono text-xs text-label">
            <Suspense fallback={null}>
              <RequestedPath />
            </Suspense>
          </span>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/" className={primary}>
              Go home
            </Link>
            <GoBackButton className={secondary} />
          </div>
          {enabledModules.length > 0 ? (
            <nav aria-label="Jump to" className="mt-6 flex flex-wrap items-center gap-x-5 text-sm">
              <span className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">Or jump to</span>
              {enabledModules.map((m) => (
                <Link key={m.key} href={m.href} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                  {m.navLabel}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        <NotFoundNetwork className="mx-auto w-full max-w-[300px] md:max-w-[520px]" />
      </div>
    </main>
  );
}

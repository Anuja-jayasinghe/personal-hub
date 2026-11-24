import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

const action =
  "hit-44 flex min-h-9 shrink-0 items-center rounded-lg px-2.5 font-semibold text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The strip at the top of every page in the demo (S.9, C118), in the offline banner's style: a DEMO tag,
 * one line on what this is, and the way out (sign in, or another account while waiting for approval).
 */
export function DemoBanner({ waitingAs }: { waitingAs: string | null }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border bg-raised px-3.5 py-2.5 text-sm">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-status-soon/15 px-2 py-1 font-mono text-[10.5px] font-semibold tracking-[0.14em] text-status-soon uppercase">
        <span aria-hidden className="size-[7px] rounded-full bg-status-soon-mark" />
        Demo
      </span>
      <p className="min-w-0 flex-1">
        {waitingAs ? (
          <>
            Sample data while you wait: <span className="font-medium">{waitingAs}</span> is waiting for the owner’s approval.
          </>
        ) : (
          <>Sample data. Nothing here is real, and nothing can be saved.</>
        )}
      </p>
      {waitingAs ? (
        <SignOutButton redirectUrl="/sign-in">
          <button type="button" className={action}>
            Use another account
          </button>
        </SignOutButton>
      ) : (
        <Link href="/sign-in" className={action}>
          Sign in
        </Link>
      )}
    </div>
  );
}

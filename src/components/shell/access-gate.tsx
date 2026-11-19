import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { HubMark } from "@/components/brand/hub-mark";
import { getAuthState } from "@/lib/auth";

const primary =
  "flex min-h-13 w-full items-center justify-center rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** The centred card the refusals sit in (board HStates "Not on the list"): the J mark in quiet grey, a tag, a title. */
function Refusal({ tag, tone, title, children }: { tag: string; tone: "overdue" | "soon"; title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <HubMark size={64} title="hub" className="mb-2 text-quiet" />
        <span className={`inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.14em] uppercase ${tone === "overdue" ? "text-status-overdue" : "text-status-soon"}`}>
          <span aria-hidden className={`size-[7px] rounded-full ${tone === "overdue" ? "bg-status-overdue" : "bg-status-soon-mark"}`} />
          {tag}
        </span>
        <h1 className="font-display text-[2rem] leading-tight font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

/** "Not on the list" (board HStates): signed in, but not on ALLOWED_EMAILS. */
export function NotAllowedScreen({ email }: { email: string | null }) {
  return (
    <Refusal tag="Not on the list" tone="overdue" title="This hub is invite-only">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        You are signed in{email ? <> as <span className="font-medium text-foreground">{email}</span></> : null}, but this account is not on the list. Ask
        the person who runs this hub to add you, then come back.
      </p>
      <div className="mt-2 w-full">
        <SignOutButton redirectUrl="/sign-in">
          <button type="button" className={primary}>
            Use another account
          </button>
        </SignOutButton>
      </div>
    </Refusal>
  );
}

/** Signed in by themselves, waiting for the owner to approve them (S.8, C114). A demo of the hub comes later. */
export function WaitingScreen({ email }: { email: string }) {
  return (
    <Refusal tag="Waiting for approval" tone="soon" title="You are on the list to join">
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        You are signed in as <span className="font-medium text-foreground">{email}</span>. The person who runs this hub decides what you can see; once they
        approve you, the parts they share appear here.
      </p>
      <div className="mt-2 w-full">
        <SignOutButton redirectUrl="/sign-in">
          <button type="button" className={primary}>
            Use another account
          </button>
        </SignOutButton>
      </div>
    </Refusal>
  );
}

/**
 * Wraps the whole app shell: only a signed-in person on the allowed list sees anything. The
 * children are only rendered when access is granted, so no page code or database query runs for
 * anyone else (Phase 4.1, DECISIONS C61). Use inside <Suspense>: it reads the session.
 * Restyled in R.6 (board HStates).
 */
export async function AccessGate({ children }: { children: React.ReactNode }) {
  const state = await getAuthState();
  if (state.status === "ok") return <>{children}</>;

  if (state.status === "not-configured") {
    return (
      <Refusal tag="Not set up" tone="soon" title="Login is not set up yet">
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          The hub stays closed until it knows who may use it. Add your email address to <code className="font-mono text-[13px]">ALLOWED_EMAILS</code> in{" "}
          <code className="font-mono text-[13px]">.env.local</code> and restart the app (see SETUP.md).
        </p>
      </Refusal>
    );
  }

  if (state.status === "not-allowed") return <NotAllowedScreen email={state.email} />;
  if (state.status === "pending") return <WaitingScreen email={state.email} />;

  return (
    <Refusal tag="Signed out" tone="soon" title="Please sign in">
      <p className="text-[15px] leading-relaxed text-muted-foreground">Only people on the list can open the hub.</p>
      <Link href="/sign-in" className={`${primary} mt-2`}>
        Go to sign in
      </Link>
    </Refusal>
  );
}

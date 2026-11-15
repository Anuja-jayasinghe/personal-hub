import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getAuthState } from "@/lib/auth";

/**
 * Wraps the whole app shell: only a signed-in person on the allowed list sees anything. The
 * children are only rendered when access is granted, so no page code or database query runs for
 * anyone else (Phase 4.1, DECISIONS C61). Use inside <Suspense>: it reads the session.
 */
export async function AccessGate({ children }: { children: React.ReactNode }) {
  const state = await getAuthState();
  if (state.status === "ok") return <>{children}</>;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-1 flex-col justify-center gap-4 p-6">
      {state.status === "not-configured" ? (
        <>
          <h1 className="text-xl font-semibold">Login is not set up yet</h1>
          <p className="text-sm text-muted-foreground">
            The hub is closed until it knows who may use it. Add your email address to <code>ALLOWED_EMAILS</code> in <code>.env.local</code> and restart the
            app (see SETUP.md).
          </p>
        </>
      ) : state.status === "not-allowed" ? (
        <>
          <h1 className="text-xl font-semibold">This account is not allowed</h1>
          <p className="text-sm text-muted-foreground">
            {state.email ? <>You are signed in as {state.email}, which</> : <>The account you are signed in with</>} is not on the list of people who may use this
            hub.
          </p>
          <div>
            <SignOutButton>
              <Button variant="outline">Sign out</Button>
            </SignOutButton>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Please sign in</h1>
          <Link href="/sign-in" className="text-sm font-medium underline-offset-2 hover:underline">
            Go to the sign-in page
          </Link>
        </>
      )}
    </main>
  );
}

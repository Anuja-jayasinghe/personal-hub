import { connection } from "next/server";
import { getAuthState } from "@/lib/auth";
import { AccountMenu } from "@/components/shell/account-menu";

/** Who is signed in, with Clerk's account menu (More page). Reads the session, so render it inside Suspense. */
export async function AccountCard() {
  await connection();
  const state = await getAuthState();
  const email = state.status === "ok" ? state.email : null;
  return (
    <section aria-label="Your account" className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
      <AccountMenu />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{email ?? "Signed in"}</span>
        <span className="font-mono text-[10.5px] tracking-[0.12em] text-label uppercase">Signed in</span>
      </span>
    </section>
  );
}

import "server-only";
import { db, type Db } from "@/db";
import { demoDb } from "@/db/demo";
import { AuthError, getAuthState, isDemoState } from "@/lib/auth";

/**
 * The database a page reads from (S.9, DECISIONS C118): the real one for signed-in, allowed people,
 * the in-memory demo for signed-out visitors and people waiting for approval, and nothing for anyone
 * else. Every query module gets its client here, never from `@/db` directly (a test checks this), so
 * a demo visitor can never reach real data.
 */
export async function readDb(): Promise<Db> {
  const state = await getAuthState();
  if (state.status === "ok") return db;
  if (isDemoState(state)) return demoDb();
  throw new AuthError("You are not signed in as an allowed user. Reload the page and sign in.");
}

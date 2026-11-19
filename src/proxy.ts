import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Runs Clerk on every request so the app can read the session (Phase 4.1, DECISIONS C61). Since the
 * demo (S.9, C118) it no longer sends signed-out visitors to /sign-in: they see the demo instead.
 * The real gates are in the app: `AccessGate` and `readDb` decide between the real hub, the demo
 * (sample data only) and a refusal; every Server Action calls `requireUser`, which refuses demo
 * visitors; the file and download routes check `getAuthState()` themselves.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, run for everything else (Clerk's recommended matcher).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

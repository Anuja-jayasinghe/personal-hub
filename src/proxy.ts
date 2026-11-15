import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * First gate (Phase 4.1, DECISIONS C61): everything except the sign-in and sign-up pages needs a
 * signed-in Clerk session, otherwise the visitor is sent to /sign-in. Whether the signed-in person
 * is on the allowed list is checked in the app itself (src/lib/auth.ts) by the layout, the file
 * route and every Server Action, so this file is never the only protection.
 */
const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublic(request)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, run for everything else (Clerk's recommended matcher).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

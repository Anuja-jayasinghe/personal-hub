/**
 * Response headers for the hub (issue #207, DECISIONS C143). Kept in a plain module, with no imports,
 * so `next.config.ts` can use it and a unit test can check it.
 *
 * Rule for this file: no two entries that can match the same path may set the same header, because
 * how a host merges a repeated header (last one wins, or both are sent) is not something to rely on.
 * The sources below are chosen so every path is matched by exactly one "framing" entry.
 *
 * There is deliberately no script or style Content-Security-Policy yet: Next.js and Clerk inject
 * inline scripts, so an enforcing policy needs per-request nonces, which is its own piece of work.
 * Only the `frame-ancestors` directive is set, and it needs no nonce.
 */

export type HeaderRule = { source: string; headers: { key: string; value: string }[] };

/** Camera stays off: uploads use a plain file input (the phone's own picker), never getUserMedia. */
export const permissionsPolicy = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

/** The service worker's own policy (N.3, C140): loads nothing from anywhere else, and cannot be framed. */
export const serviceWorkerCsp = "default-src 'self'; script-src 'self'; frame-ancestors 'none'";

/** On every response, whatever the path. */
const everywhere: HeaderRule = {
  source: "/:path*",
  headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: permissionsPolicy },
    // A private app: ask search engines and archives to keep out. /robots.txt says the same (src/app/robots.ts).
    { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  ],
};

/** Nobody may frame the hub (clickjacking). Every page and route except the two entries below. */
const neverFramed: HeaderRule = {
  source: "/((?!files/|sw\\.js).*)",
  headers: [
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    { key: "X-Frame-Options", value: "DENY" },
  ],
};

/**
 * The Documents viewer shows a file in an iframe whose address is the hub's own /files/<id>. That route
 * answers with a redirect to a short-lived Supabase link, so the framed document is Supabase's, and
 * what the hub itself frames is not limited by these headers. Only the hub's own pages may frame this
 * route, so `self` (the same site) is as strict as it can be.
 */
const sameOriginFiles: HeaderRule = {
  source: "/files/:path*",
  headers: [
    { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
  ],
};

/** The service worker for iPhone push (N.3, C140): always fetched fresh, served as JavaScript, and allowed to load nothing from anywhere else. It caches nothing itself. */
const serviceWorker: HeaderRule = {
  source: "/sw.js",
  headers: [
    { key: "Content-Type", value: "application/javascript; charset=utf-8" },
    { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
    { key: "Content-Security-Policy", value: serviceWorkerCsp },
    { key: "X-Frame-Options", value: "DENY" },
  ],
};

export const securityHeaders: HeaderRule[] = [everywhere, neverFramed, sameOriginFiles, serviceWorker];

import type { Message } from "../planner";

/**
 * What a push carries (Notifications N.3, DECISIONS C140): `{ title, body, href }` and nothing else,
 * built from the planner's message (its words already follow C139: no amounts, plates or free text).
 * Pure. The service worker (public/sw.js) checks `href` again before opening it.
 */
export type PushPayload = { title: string; body: string; href: string };

/** A path on the hub itself: starts with one `/`, no `//` or `/\` (another site), no spaces, backslashes or control characters. */
export function sameOriginPath(href: unknown): string {
  if (typeof href !== "string" || href.length > 512) return "/";
  return /^\/(?![/\\])[^\s\\\u0000-\u001f\u007f]*$/.test(href) ? href : "/";
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The JSON a push carries. Push services cap a message at about 4 KB; these limits keep it far below. */
export function pushPayload(message: Pick<Message, "title" | "body" | "href">): string {
  const payload: PushPayload = { title: clip(message.title, 120), body: clip(message.body, 600), href: sameOriginPath(message.href) };
  return JSON.stringify(payload);
}

/** About 12 hours: an act-now notice that cannot be delivered by then is no longer worth showing. */
export const PUSH_TTL_SECONDS = 12 * 60 * 60;
/** How long one push service request may take before its outcome counts as unknown. */
export const PUSH_TIMEOUT_MS = 10_000;

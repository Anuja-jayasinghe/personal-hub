import "server-only";
import { createHash } from "node:crypto";
import { appConfig } from "@/config/app.config";
import { describeDays } from "@/features/reminders/engine";
import { todayIn } from "@/lib/dates";
import { NotSentError, type ChannelSender, type SendContext } from "./channels";
import type { Message, Notice } from "./planner";

/**
 * The plan-ahead email (Notifications N.2, DECISIONS C139 and C141). Resend's REST API through `fetch`
 * (no SDK), from `appConfig.emailFrom` on the verified sending subdomain, to the owner's address.
 *
 * Settings: RESEND_API_KEY (a send-only key restricted to the sending domain) and NOTIFY_EMAIL_TO (the
 * owner's delivery address, a tagged Gmail address). Both are secrets: neither is ever logged, stored
 * in an error or put in the idempotency key, and neither is in the code.
 *
 * Outcomes, as N.1's send log needs them (log.ts):
 *  - 2xx: sent;
 *  - 400, 401, 403, 404, 422, 429: Resend refused it, nothing went out: `NotSentError` (retried while
 *    timely, at most MAX_FAILED_TRIES times);
 *  - anything else: an unknown outcome, never repeated. That includes 409 (a request with the same
 *    idempotency key is in progress, or the key was used with another body: the first one may have
 *    gone out), a 5xx, a timeout and a network error.
 *
 * The message words come from the planner, which never puts an amount, a plate or free text in them.
 * Names people typed (bill names, service types, vehicle nicknames) are escaped in the HTML, and a
 * zero-width space after ".", ":" and "/" keeps Gmail from turning URL-like text into a link.
 */

export const RESEND_URL = "https://api.resend.com/emails";
export const SEND_TIMEOUT_MS = 10_000;

/** The statuses where Resend says it did not accept the message. 409 is not one of them (see above). */
const REFUSED = new Set([400, 401, 403, 404, 422, 429]);

export type EmailEnv = { RESEND_API_KEY?: string; NOTIFY_EMAIL_TO?: string; [name: string]: string | undefined };
export type EmailSetup = { apiKey: string; notifyTo: string };

const looksLikeAddress = (s: string) => /^[^\s@<>",]+@[^\s@<>",]+\.[^\s@<>",]+$/.test(s);

/** The two settings, trimmed, or null when either is missing (the email channel then stays a dry run). */
export function emailSetup(env: EmailEnv): EmailSetup | null {
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const notifyTo = env.NOTIFY_EMAIL_TO?.trim() ?? "";
  return apiKey && looksLikeAddress(notifyTo) ? { apiKey, notifyTo } : null;
}

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * An address as its mailbox: lower-cased and, for Gmail only, without its "+tag" and without dots in the
 * name, with googlemail.com as gmail.com (Gmail delivers all of those to the same inbox):
 * `Me.Name+tag@GoogleMail.com` → `mename@gmail.com`. At any other provider a "+tag" is not known to
 * mean the same mailbox (some providers treat `a+b` as a different user), so it is kept as it is. An
 * address with no name in front of the "@" is returned as it is (L2, N.2 review).
 */
export function mailbox(address: string): string {
  const clean = address.trim().toLowerCase();
  const at = clean.lastIndexOf("@");
  if (at < 1) return clean;
  let local = clean.slice(0, at);
  let domain = clean.slice(at + 1);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.split("+")[0].replace(/\./g, "");
    // "+tag@gmail.com" has nothing in front of the tag: it names no mailbox.
    if (!local) return clean;
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

/**
 * Where an owner's email goes: NOTIFY_EMAIL_TO when it is the same mailbox as the owner's own address
 * (ignoring case; for Gmail also the +tag, the dots and googlemail.com), so every hub email
 * arrives at the tagged address; any other owner gets it at their own address.
 */
export function deliveryAddress(recipient: string, notifyTo: string): string {
  return mailbox(recipient) === mailbox(notifyTo) ? notifyTo : recipient;
}

/** For Settings: `name+tag@example.com` → `na•••+tag@example.com`. Never the whole local part. */
export function maskAddress(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = address.slice(0, at);
  const plus = local.indexOf("+");
  const base = plus >= 0 ? local.slice(0, plus) : local;
  const tag = plus >= 0 ? local.slice(plus) : "";
  const shown = base.length > 3 ? base.slice(0, 2) : base.slice(0, 1);
  return `${shown}•••${tag}@${address.slice(at + 1)}`;
}

/** Escapes text for HTML text and attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** One line, without control characters, C0 or C1 (a subject is a header). */
export const oneLine = (value: string) => value.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Words people typed, made safe from auto-linking: a zero-width space after every ".", ":" and "/", so
 * a name like "evil.example/login" is not turned into a link by Gmail. Used in the text and HTML parts
 * (the HTML is escaped afterwards); never on the hub's own links.
 */
export const defuseLinks = (value: string) => value.replace(/([.:/])/g, "$1​");

/** A link into the hub: the site address plus an app path (anything else falls back to Reminders). */
const hubLink = (href: string) => `${appConfig.siteUrl}${href.startsWith("/") && !href.startsWith("//") ? href : "/reminders"}`;

export const SETTINGS_PATH = "/settings/notifications";
const FOOTER = "Change these in Settings › Notifications";

export type RenderedEmail = { subject: string; text: string; html: string };

type Line = { title: string; note: string; href: string };

/** The HTML shell shared by every email. Plain tables, inline styles, no images or pixels. */
function page(subject: string, heading: string, lines: readonly Line[], intro?: string): string {
  const e = escapeHtml;
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const mono = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
  const rows = lines
    .map(
      (l) => `<tr><td style="padding:14px 24px;border-top:1px solid #e3e8ef;">
<a href="${e(hubLink(l.href))}" style="color:#2869d8;text-decoration:none;font:600 16px/1.35 ${font};">${e(l.title)}</a>${
        l.note ? `\n<div style="padding-top:3px;color:#5b6779;font:400 13px/1.4 ${font};">${e(l.note)}</div>` : ""
      }
</td></tr>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${e(defuseLinks(subject))}</title>
</head>
<body style="margin:0;padding:0;background:#ecf0f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ecf0f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border:1px solid #d5dce6;border-radius:18px;">
<tr><td style="padding:22px 24px 4px;color:#2869d8;font:600 11px/1.4 ${mono};letter-spacing:0.16em;text-transform:uppercase;">${e(appConfig.name)}</td></tr>
<tr><td style="padding:0 24px 14px;"><h1 style="margin:0;color:#11151d;font:600 21px/1.3 ${font};">${e(heading)}</h1>${
    intro ? `<p style="margin:8px 0 0;color:#5b6779;font:400 14px/1.5 ${font};">${e(intro)}</p>` : ""
  }</td></tr>
${rows}
<tr><td style="padding:16px 24px 22px;border-top:1px solid #e3e8ef;color:#5b6779;font:400 12px/1.5 ${font};">${e(appConfig.name)} writes only when something is new. <a href="${e(hubLink(SETTINGS_PATH))}" style="color:#2869d8;font-weight:600;">${e(FOOTER)}</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const textFooter = () => ["", `${appConfig.name} writes only when something is new.`, `${FOOTER}: ${hubLink(SETTINGS_PATH)}`];

/** A system notice (N.3: "iPhone stopped accepting pushes") speaks for itself; a planner notice says when. */
const isSystem = (n: Notice) => n.step === "system";
const noteOf = (n: Notice) => defuseLinks(isSystem(n) ? n.body : describeDays(n.daysUntil));

/**
 * The email for one batched message. The subject is the planner's (C139): `hub · <what> · <when>`, or
 * `hub · N things coming up`. Each item links into the hub through its own href. A planner notice says
 * when ("In 30 days"); a system notice (N.3's push-gone email) says its own body, and alone it is the
 * email's heading and text.
 */
export function renderEmail(message: Message): RenderedEmail {
  const subject = oneLine(message.title);
  const notices = message.notices;
  const onlySystem = notices.length > 0 && notices.every(isSystem);

  if (onlySystem && notices.length === 1) {
    // Its link is the footer's when it points at Settings › Notifications, otherwise a line of its own.
    const [n] = notices;
    const title = defuseLinks(n.title);
    const body = defuseLinks(n.body);
    const own = n.href !== SETTINGS_PATH;
    const lines = own ? [{ title: `Open ${appConfig.name}`, note: "", href: n.href }] : [];
    const text = [title, "", body, ...(own ? ["", hubLink(n.href)] : []), ...textFooter()].join("\n");
    return { subject, text, html: page(subject, title, lines, body) };
  }

  const lines = notices.map((n) => ({ title: defuseLinks(n.title), note: noteOf(n), href: n.href }));
  const heading = onlySystem ? `${notices.length} updates` : notices.length === 1 ? "Coming up" : `${notices.length} things coming up`;
  const text = [
    ...notices.map((n) =>
      isSystem(n) ? `• ${defuseLinks(n.title)}\n  ${noteOf(n)}\n  ${hubLink(n.href)}` : `• ${defuseLinks(n.title)} (${noteOf(n).toLowerCase()})\n  ${hubLink(n.href)}`,
    ),
    ...textFooter(),
  ].join("\n");
  return { subject, text, html: page(subject, heading, lines) };
}

export const TEST_SUBJECT = `${appConfig.name} · Test`;

/** "Send a test email" in Settings: a fixed subject, no notices. */
export function renderTestEmail(): RenderedEmail {
  const intro = "This is a test. Plan-ahead notices arrive like this: renewals 30 days before, services 14, electricity bills 7.";
  const text = [intro, "", hubLink(SETTINGS_PATH), ...textFooter()].join("\n");
  return { subject: TEST_SUBJECT, text, html: page(TEST_SUBJECT, "Email works", [], intro) };
}

const sha = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 32);

/**
 * Resend's Idempotency-Key for a notice email: the same recipient, day and notices give the same key,
 * so a repeated request within 24 hours cannot send twice. A hash: it never contains the address.
 */
export function noticeIdempotencyKey(to: string, day: string, dedupeKeys: readonly string[]): string {
  return `hub-email/${sha([to.toLowerCase(), day, ...[...dedupeKeys].sort()].join("\n"))}`;
}

/** The test email's key: one per address and minute (the button is limited to one a minute). */
export function testIdempotencyKey(to: string, now: Date): string {
  return `hub-email-test/${sha(`${to.toLowerCase()}\n${now.toISOString().slice(0, 16)}`)}`;
}

/**
 * Takes anything secret out of a provider message before it is stored or shown: the key and the
 * addresses given, anything that looks like an email address, a Resend key or a bearer token.
 */
export function scrubSecrets(text: string, secrets: readonly string[] = []): string {
  let out = text;
  for (const s of secrets) {
    if (s.length < 4) continue;
    out = out.replace(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[hidden]");
  }
  return out
    .replace(/[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+/g, "[address]")
    .replace(/\bre_[A-Za-z0-9_-]{4,}/g, "[key]")
    .replace(/Bearer\s+\S+/gi, "Bearer [hidden]");
}

export type SendDeps = {
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type OutgoingEmail = RenderedEmail & { to: string; idempotencyKey: string };

/** Resend's error body is `{ statusCode, name, message }`; only a safe name and a scrubbed message are kept. */
async function refusalDetail(res: Response, secrets: readonly string[]): Promise<string> {
  try {
    const body = (await res.json()) as { name?: unknown; message?: unknown };
    const name = typeof body.name === "string" && /^[a-z_]{1,48}$/.test(body.name) ? body.name : "";
    const message = typeof body.message === "string" ? scrubSecrets(body.message, secrets).slice(0, 160) : "";
    return [name, message].filter(Boolean).join(": ");
  } catch {
    return "";
  }
}

/**
 * POSTs one email to Resend. Resolves when Resend accepted it; throws `NotSentError` when Resend
 * refused it; throws a plain Error (an unknown outcome) on a 409, a 5xx, a timeout or a network error.
 * Error messages never include the key, the address or the body. Nothing is logged here.
 */
export async function postToResend(setup: EmailSetup, email: OutgoingEmail, deps: SendDeps = {}): Promise<void> {
  const doFetch = deps.fetch ?? fetch;
  const secrets = [setup.apiKey, setup.notifyTo, email.to];
  let res: Response;
  try {
    res = await doFetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${setup.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({ from: appConfig.emailFrom, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
      signal: AbortSignal.timeout(deps.timeoutMs ?? SEND_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new Error(`Resend did not answer within ${Math.round((deps.timeoutMs ?? SEND_TIMEOUT_MS) / 1000)} s`);
    throw new Error("Could not reach Resend (network error)");
  }
  if (res.ok) return;
  if (REFUSED.has(res.status)) {
    const detail = await refusalDetail(res, secrets);
    throw new NotSentError(`Resend refused it (${res.status}${detail ? `, ${detail}` : ""})`);
  }
  if (res.status === 409) throw new Error("Resend answered 409 (the same request may be in progress or done)");
  throw new Error(`Resend answered ${res.status}`);
}

/**
 * The email channel for the daily run. "Implemented" only while both settings are present (read when
 * asked, not when loaded); the run also needs the owner's switch in Settings before it sends. The day
 * in the idempotency key is the run's own day (`context.today`); without one, today in the app time zone.
 */
export function emailSender(env: () => EmailEnv = () => process.env, deps: SendDeps = {}): ChannelSender {
  return {
    channel: "email",
    get implemented() {
      return emailSetup(env()) !== null;
    },
    async send(message: Message, context?: SendContext) {
      const setup = emailSetup(env());
      if (!setup) throw new NotSentError("Email is not set up (RESEND_API_KEY or NOTIFY_EMAIL_TO missing).");
      const to = deliveryAddress(message.recipient, setup.notifyTo);
      const day = context?.today ?? todayIn(appConfig.timeZone, new Date());
      const idempotencyKey = noticeIdempotencyKey(
        to,
        day,
        message.notices.map((n) => n.dedupeKey),
      );
      await postToResend(setup, { ...renderEmail(message), to, idempotencyKey }, deps);
    },
  };
}

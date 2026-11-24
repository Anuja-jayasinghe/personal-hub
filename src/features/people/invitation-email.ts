import { createHash } from "node:crypto";
import { appConfig } from "@/config/app.config";
import { NotSentError } from "@/features/notifications/channels";

/**
 * The invitation email (issue #236, DECISIONS C154): a one-off transactional message, not a notice, so it
 * does not go through the notification planner or its send log. Resend's REST API through `fetch` (no SDK),
 * like src/features/notifications/email.ts, with the same outcome classification:
 *  - 2xx: sent;
 *  - 400, 401, 403, 404, 422, 429: Resend refused it, nothing went out: `NotSentError`;
 *  - anything else (409, a 5xx, a timeout, a network error): an unknown outcome, never repeated here.
 *
 * Rules for what is sent: from `appConfig.emailFrom`, NO reply-to (the owner's own address is never used
 * or shown), no tracking pixel, no images (mail apps block them), nothing private (no amounts, plates or
 * document numbers: only the inviter's first name and section names). Names are escaped in the HTML and
 * defused against auto-linking in both parts.
 *
 * Everything here takes its inputs as parameters (the setting, the gate, `fetch`), reads nothing from the
 * request and imports nothing server-only, so a script can run the very same code with the real key.
 */

export const RESEND_URL = "https://api.resend.com/emails";
export const SEND_TIMEOUT_MS = 10_000;
const REFUSED = new Set([400, 401, 403, 404, 422, 429]);

export type InvitationEmailSetup = { apiKey: string };

/** The one setting (RESEND_API_KEY, already used by the notification email), or null when it is missing. */
export function invitationEmailSetup(env: { RESEND_API_KEY?: string; [name: string]: string | undefined }): InvitationEmailSetup | null {
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  return apiKey ? { apiKey } : null;
}

/**
 * True only on the live site (`VERCEL_ENV=production`), like the notification run: previews and local
 * development share the real database and must never email a real person. Pass the result in; nothing
 * deeper reads the environment.
 */
export function invitationsAreLive(env: { VERCEL_ENV?: string; [name: string]: string | undefined }): boolean {
  return env.VERCEL_ENV === "production";
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/** Names people typed, made safe from auto-linking: a zero-width space after every ".", ":" and "/". */
const defuseLinks = (value: string) => value.replace(/([.:/])/g, "$1​");
const oneLine = (value: string) => value.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").replace(/\s+/g, " ").trim();

/** The inviter's first name for the email and the sign-up page: one word, no control characters, at most 30 characters. */
export function inviterFirstName(raw: string | null | undefined): string | null {
  const first = oneLine(raw ?? "").split(" ")[0]?.slice(0, 30) ?? "";
  return first || null;
}

export type InvitationEmailInput = {
  /** A first name, never an address. Null: the email says "You have been invited". */
  inviterFirstName: string | null;
  /** From `summariseAccess`: "See and add Vehicles". */
  accessLines: readonly string[];
  /** The sign-up link with the invitation code. */
  link: string;
  expiresAt: Date;
};

export type RenderedInvitation = { subject: string; text: string; html: string };

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: appConfig.timeZone });

export const FOOTER_LINE = "If you did not expect this, ignore this email.";

/** Builds the subject, plain text and HTML. Pure. */
export function buildInvitationEmail(input: InvitationEmailInput): RenderedInvitation {
  const name = input.inviterFirstName ? oneLine(input.inviterFirstName) : null;
  const heading = name ? `${name} invited you to ${appConfig.name}` : `You have been invited to ${appConfig.name}`;
  const subject = oneLine(heading);
  const about = `${appConfig.name} is a private place for a household's bills, vehicles and more.`;
  const ends = dateFormatter.format(input.expiresAt);
  const signUp = `Sign up with this email address (the one this message was sent to). The invitation ends on ${ends}.`;
  const lines = input.accessLines.length > 0 ? input.accessLines : ["Look around once you are in"];
  const lead = "With this invitation you will be able to:";

  const text = [
    defuseLinks(heading),
    "",
    about,
    "",
    lead,
    ...lines.map((l) => `- ${l}`),
    "",
    `Sign up here: ${input.link}`,
    "",
    signUp,
    "",
    FOOTER_LINE,
  ].join("\n");

  const e = escapeHtml;
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${e(defuseLinks(subject))}</title>
</head>
<body style="margin:0;padding:0;background:#0d1118;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d1118" style="background:#0d1118;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1a2230" style="max-width:520px;background:#1a2230;border:1px solid #303b4b;border-radius:18px;">
<tr><td style="padding:24px 24px 6px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="36" height="36" align="center" valign="middle" bgcolor="#4388f5" style="width:36px;height:36px;background:#4388f5;border-radius:10px;color:#0d1118;font:700 20px/36px ${font};">J</td>
<td style="padding-left:10px;color:#f2f5fa;font:600 22px/1 ${font};letter-spacing:-0.04em;">${e(appConfig.name)}</td>
</tr></table>
</td></tr>
<tr><td style="padding:14px 24px 0;"><h1 style="margin:0;color:#f2f5fa;font:600 22px/1.3 ${font};">${e(defuseLinks(heading))}</h1></td></tr>
<tr><td style="padding:10px 24px 0;color:#b7c0cd;font:400 15px/1.5 ${font};">${e(about)}</td></tr>
<tr><td style="padding:16px 24px 0;color:#b7c0cd;font:400 15px/1.5 ${font};">${e(lead)}
<ul style="margin:6px 0 0;padding-left:20px;color:#f2f5fa;">${lines.map((l) => `<li style="margin:3px 0;">${e(l)}</li>`).join("")}</ul></td></tr>
<tr><td style="padding:22px 24px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="#4388f5" style="background:#4388f5;border-radius:12px;"><a href="${e(input.link)}" style="display:inline-block;padding:14px 26px;color:#0d1118;text-decoration:none;font:600 16px/1.2 ${font};">Sign up to ${e(appConfig.name)}</a></td>
</tr></table>
</td></tr>
<tr><td style="padding:14px 24px 0;color:#929eaf;font:400 12px/1.5 ${font};">Or paste this link into your browser:<br><a href="${e(input.link)}" style="color:#7aaaf8;word-break:break-all;">${e(input.link)}</a></td></tr>
<tr><td style="padding:18px 24px 0;color:#f2f5fa;font:400 14px/1.5 ${font};">${e(signUp)}</td></tr>
<tr><td style="padding:18px 24px 24px;"><div style="border-top:1px solid #303b4b;padding-top:14px;color:#929eaf;font:400 12px/1.5 ${font};">${e(FOOTER_LINE)}</div></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, text, html };
}

export type InvitationMessage = RenderedInvitation & { to: string; idempotencyKey: string };

/** Resend's Idempotency-Key for one send: the same person and send number give the same key. A hash: no address in it. */
export function invitationIdempotencyKey(personId: string, sendCount: number): string {
  return `hub-invite/${createHash("sha256").update(`${personId}:${sendCount}`).digest("hex").slice(0, 32)}`;
}

export type SendDeps = { fetch?: typeof fetch; timeoutMs?: number };

/** Resend's error body is `{ statusCode, name, message }`: only the safe `name` is kept, never the message. */
async function refusalName(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { name?: unknown };
    return typeof body.name === "string" && /^[a-z_]{1,48}$/.test(body.name) ? body.name : "";
  } catch {
    return "";
  }
}

/**
 * POSTs one invitation to Resend. Resolves when Resend accepted it; throws `NotSentError` when Resend
 * refused it (nothing went out); throws a plain Error (an unknown outcome) on a 409, a 5xx, a timeout or
 * a network error. Messages never include the key, the address or the body. Nothing is logged here.
 * No `reply_to` is ever set.
 */
export async function sendInvitationEmail(setup: InvitationEmailSetup, message: InvitationMessage, deps: SendDeps = {}): Promise<void> {
  const doFetch = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? SEND_TIMEOUT_MS;
  let res: Response;
  try {
    res = await doFetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${setup.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": message.idempotencyKey },
      body: JSON.stringify({ from: appConfig.emailFrom, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new Error(`Resend did not answer within ${Math.round(timeoutMs / 1000)} s`);
    throw new Error("Could not reach Resend (network error)");
  }
  if (res.ok) return;
  if (REFUSED.has(res.status)) {
    const name = await refusalName(res);
    throw new NotSentError(`Resend refused it (${res.status}${name ? `, ${name}` : ""})`);
  }
  if (res.status === 409) throw new Error("Resend answered 409 (the same request may be in progress or done)");
  throw new Error(`Resend answered ${res.status}`);
}

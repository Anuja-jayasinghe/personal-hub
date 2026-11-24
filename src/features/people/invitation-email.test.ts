import { describe, expect, it, vi } from "vitest";
import { appConfig } from "@/config/app.config";
import { NotSentError } from "@/features/notifications/channels";
import {
  buildInvitationEmail,
  invitationEmailSetup,
  invitationIdempotencyKey,
  invitationsAreLive,
  inviterFirstName,
  RESEND_URL,
  sendInvitationEmail,
  type InvitationEmailInput,
  type InvitationMessage,
} from "./invitation-email";

/** The invitation email (issue #236, DECISIONS C154): content rules and the Resend call, with a fake fetch. Made-up data only. */
const LINK = "https://hub.example.test/sign-up?invite=abcdefghijklmnopqrstuv";
const input = (over: Partial<InvitationEmailInput> = {}): InvitationEmailInput => ({
  inviterFirstName: "Asha",
  accessLines: ["See and add Vehicles", "See Bills & subscriptions"],
  link: LINK,
  expiresAt: new Date("2026-12-08T04:00:00Z"),
  ...over,
});

describe("buildInvitationEmail", () => {
  it("says who invited them, what they can do, one button, the link, the end date and the footer", () => {
    const { subject, text, html } = buildInvitationEmail(input());
    expect(subject).toBe("Asha invited you to hub");
    expect(text).toContain("Asha invited you to hub");
    expect(text).toContain("- See and add Vehicles");
    expect(text).toContain("- See Bills & subscriptions");
    expect(text).toContain(`Sign up here: ${LINK}`);
    expect(text).toContain("Sign up with this email address (the one this message was sent to). The invitation ends on 8 December 2026.");
    expect(text).toContain("If you did not expect this, ignore this email.");
    // One button, and the plain link as a fallback.
    expect(html.match(/<a href=/g)).toHaveLength(2);
    expect(html).toContain(`<a href="${LINK}" style="display:inline-block`);
    expect(html).toContain("#4388f5");
    expect(html).toContain("Sign up to hub");
    expect(html).toContain("See and add Vehicles");
    expect(html).toContain("See Bills &amp; subscriptions");
    expect(html).toContain("The invitation ends on 8 December 2026.");
  });

  it("has no tracking pixel, no image, no script, no remote resource and nothing private", () => {
    const { html, text } = buildInvitationEmail(input());
    expect(html).not.toMatch(/<img|<script|<link|<iframe|<svg|url\(|@import/i);
    for (const body of [html, text]) {
      expect(body).not.toMatch(/LKR|\d{4}-\d{4}|[A-Z]{3}-\d{4}|@example\.com/);
      expect(body).not.toContain("reply");
    }
    // The only URL is the sign-up link.
    expect([...new Set(html.match(/https?:\/\/[^"'<\s]+/g))]).toEqual([LINK]);
    expect([...new Set(text.match(/https?:\/\/\S+/g))]).toEqual([LINK]);
  });

  it("escapes a name in the HTML and defuses links in the name", () => {
    const { subject, html, text } = buildInvitationEmail(input({ inviterFirstName: `<b onload="x">Evil.example/login&co</b>` }));
    expect(html).not.toContain("<b onload");
    expect(html).toContain("&lt;b onload=&quot;x&quot;&gt;");
    expect(html).not.toContain("Evil.example/login");
    expect(text).not.toContain("Evil.example/login");
    expect(subject).toContain("Evil.example/login"); // a header is plain text; the subject is not auto-linked
  });

  it("keeps the subject on one line whatever the name holds", () => {
    expect(buildInvitationEmail(input({ inviterFirstName: "A\r\nBcc: x@example.com" })).subject).not.toMatch(/[\r\n]/);
  });

  it("without a name it says you have been invited", () => {
    const { subject, text } = buildInvitationEmail(input({ inviterFirstName: null }));
    expect(subject).toBe("You have been invited to hub");
    expect(text).toContain("You have been invited to hub");
  });

  it("holds no secret: no key, no sender address, no owner address", () => {
    const { html, text, subject } = buildInvitationEmail(input());
    for (const body of [html, text, subject]) {
      expect(body).not.toContain("re_");
      expect(body).not.toContain("notify@");
      expect(body).not.toMatch(/Bearer/i);
    }
  });
});

describe("inviterFirstName", () => {
  it("is one short word", () => {
    expect(inviterFirstName("  Asha  Perera ")).toBe("Asha");
    expect(inviterFirstName("A".repeat(80))).toHaveLength(30);
    expect(inviterFirstName("")).toBeNull();
    expect(inviterFirstName(null)).toBeNull();
    expect(inviterFirstName("\n\t")).toBeNull();
  });
});

describe("the setting and the gate", () => {
  it("needs RESEND_API_KEY", () => {
    expect(invitationEmailSetup({})).toBeNull();
    expect(invitationEmailSetup({ RESEND_API_KEY: "  " })).toBeNull();
    expect(invitationEmailSetup({ RESEND_API_KEY: " re_test_key " })).toEqual({ apiKey: "re_test_key" });
  });

  it("is live only in production", () => {
    expect(invitationsAreLive({ VERCEL_ENV: "production" })).toBe(true);
    for (const env of [undefined, "preview", "development", "Production", ""]) expect(invitationsAreLive({ VERCEL_ENV: env })).toBe(false);
    expect(invitationsAreLive({})).toBe(false);
  });

  it("makes one idempotency key per person and send number, with no address in it", () => {
    const a = invitationIdempotencyKey("11111111-1111-4111-8111-111111111111", 1);
    expect(a).toBe(invitationIdempotencyKey("11111111-1111-4111-8111-111111111111", 1));
    expect(a).not.toBe(invitationIdempotencyKey("11111111-1111-4111-8111-111111111111", 2));
    expect(a).not.toBe(invitationIdempotencyKey("22222222-2222-4222-8222-222222222222", 1));
    expect(a).toMatch(/^hub-invite\/[0-9a-f]{32}$/);
  });
});

describe("sendInvitationEmail", () => {
  const setup = { apiKey: "re_secret_test_key" };
  const message: InvitationMessage = { ...buildInvitationEmail(input()), to: "someone@example.com", idempotencyKey: "hub-invite/abc" };
  const reply = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("posts to Resend from the hub's own sender, to one address, with no reply-to, with the idempotency key", async () => {
    const fetch = reply(200, { id: "x" });
    await sendInvitationEmail(setup, message, { fetch });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(RESEND_URL);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_secret_test_key");
    expect(init.headers["Idempotency-Key"]).toBe("hub-invite/abc");
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({ from: appConfig.emailFrom, to: ["someone@example.com"], subject: message.subject, text: message.text, html: message.html });
    expect(Object.keys(body).join()).not.toMatch(/reply|bcc|cc|headers|tags/i);
    expect(init.signal).toBeDefined();
  });

  it("a refusal (400, 401, 403, 404, 422, 429) means nothing went out, and says nothing private", async () => {
    for (const status of [400, 401, 403, 404, 422, 429]) {
      const err = await sendInvitationEmail(setup, message, { fetch: reply(status, { name: "validation_error", message: "bad someone@example.com re_secret_test_key" }) }).catch((e) => e);
      expect(err).toBeInstanceOf(NotSentError);
      expect(err.message).toBe(`Resend refused it (${status}, validation_error)`);
      expect(err.message).not.toContain("someone@");
      expect(err.message).not.toContain("re_secret");
    }
  });

  it("anything else is an unknown outcome, never a NotSentError", async () => {
    for (const status of [409, 500, 502, 503]) {
      const err = await sendInvitationEmail(setup, message, { fetch: reply(status) }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(NotSentError);
    }
    const network = await sendInvitationEmail(setup, message, {
      fetch: vi.fn(async () => {
        throw new TypeError("fetch failed for someone@example.com");
      }),
    }).catch((e) => e);
    expect(network.message).toBe("Could not reach Resend (network error)");
    const timeout = await sendInvitationEmail(setup, message, {
      fetch: vi.fn(async () => {
        throw new DOMException("aborted", "TimeoutError");
      }),
      timeoutMs: 10_000,
    }).catch((e) => e);
    expect(timeout.message).toBe("Resend did not answer within 10 s");
    expect(timeout).not.toBeInstanceOf(NotSentError);
  });
});

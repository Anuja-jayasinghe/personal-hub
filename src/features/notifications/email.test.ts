import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { appConfig } from "@/config/app.config";
import type { ReminderItem } from "@/features/reminders/engine";
import { addDays } from "@/lib/dates";
import { channelModes, NotSentError, parseSwitches, SENDERS } from "./channels";
import {
  defuseLinks,
  deliveryAddress,
  emailSender,
  emailSetup,
  escapeHtml,
  mailbox,
  maskAddress,
  noticeIdempotencyKey,
  oneLine,
  postToResend,
  RESEND_URL,
  renderEmail,
  renderTestEmail,
  scrubSecrets,
  testIdempotencyKey,
} from "./email";
import { planNotifications, type Message } from "./planner";
import { systemMessage } from "./system";

vi.mock("server-only", () => ({}));

// Everything here is made up (public repo): example.com addresses, a fake key.
const KEY = "re_FAKE_test_key_123456";
const TO = "owner+tag@example.com";
const OWNER = "owner@example.com";
const ENV = { RESEND_API_KEY: KEY, NOTIFY_EMAIL_TO: TO };
const TODAY = "2026-11-23";
const MORNING = new Date(`${TODAY}T02:10:00Z`);

function renewal(days: number, who = "Silver car", id = "renewal:r1"): ReminderItem {
  return { id, title: `Insurance · ${who}`, dueDate: addDays(TODAY, days), href: "/vehicles/v1?item=renewal:r1", kind: "renewal", notice: { what: "Insurance", who } };
}
function service(days: number, who = "Silver car"): ReminderItem {
  return { id: "service:s1", title: `Full service · ${who}`, dueDate: addDays(TODAY, days), href: "/vehicles/v1?item=service:s1", kind: "service", notice: { what: "Full service", who } };
}
function electricity(days: number): ReminderItem {
  // The title holds an account number and an amount; a message must never carry them.
  return { id: "electricity-bill:e1", title: "Electricity bill · Account DEMO-0001 · LKR 4,250.00", dueDate: addDays(TODAY, days), href: "/bills#electricity-bill-e1", kind: "bill", notice: { what: "Electricity bill", who: "Main house" } };
}

function emailOf(items: ReminderItem[], recipient = OWNER): Message {
  const plan = planNotifications({ recipient, items, today: TODAY, usedKeys: new Set() });
  const message = plan.messages.find((m) => m.channel === "email");
  if (!message) throw new Error("no email planned");
  return message;
}

function okFetch() {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
}
const bodyOf = (f: ReturnType<typeof okFetch>, call = 0) => JSON.parse(String(f.mock.calls[call][1]?.body));
const headersOf = (f: ReturnType<typeof okFetch>, call = 0) => f.mock.calls[call][1]?.headers as Record<string, string>;

describe("routing", () => {
  it("an owner whose Gmail address is NOTIFY_EMAIL_TO without the +tag gets it at NOTIFY_EMAIL_TO", () => {
    expect(deliveryAddress("testusernotreal0@gmail.com", "testusernotreal0+tag@gmail.com")).toBe("testusernotreal0+tag@gmail.com");
    expect(deliveryAddress("TestUserNotReal0@GMAIL.COM", "testusernotreal0+tag@gmail.com")).toBe("testusernotreal0+tag@gmail.com");
    expect(deliveryAddress("testusernotreal0+other@gmail.com", "TESTUSERNOTREAL0+tag@gmail.com")).toBe("TESTUSERNOTREAL0+tag@gmail.com");
  });

  it("a +tag is only ignored for Gmail: at any other provider it is a different mailbox (N.2 review, L2)", () => {
    expect(deliveryAddress("owner@example.com", "owner+tag@example.com")).toBe("owner@example.com");
    expect(deliveryAddress("owner+other@example.com", "owner+tag@example.com")).toBe("owner+other@example.com");
    // The same address, written another way, is still the same mailbox.
    expect(deliveryAddress("Owner+Tag@Example.COM", "owner+tag@example.com")).toBe("owner+tag@example.com");
  });

  it("an address with nothing in front of the tag names no mailbox", () => {
    expect(mailbox("+tag@gmail.com")).toBe("+tag@gmail.com");
    expect(mailbox("@gmail.com")).toBe("@gmail.com");
    expect(deliveryAddress("+tag@gmail.com", "+tag@gmail.com")).toBe("+tag@gmail.com");
    expect(deliveryAddress("+a@gmail.com", "+b@gmail.com")).toBe("+a@gmail.com");
    expect(deliveryAddress("test.user.not.real.2@gmail.com", "+tag@gmail.com")).toBe("test.user.not.real.2@gmail.com");
  });

  it("any other owner gets it at their own address", () => {
    expect(deliveryAddress("second@example.com", "owner+tag@example.com")).toBe("second@example.com");
    expect(deliveryAddress("owner@example.org", "owner+tag@example.com")).toBe("owner@example.org");
    expect(deliveryAddress("owners@example.com", "owner+tag@example.com")).toBe("owners@example.com");
    // Dots only fold away for Gmail, where they do not matter.
    expect(deliveryAddress("own.er@example.com", "owner+tag@example.com")).toBe("own.er@example.com");
  });

  it("matches a Gmail address however its dots and domain are written", () => {
    // Made-up mailboxes (Gmail's rules need Gmail's domains).
    expect(deliveryAddress("test.user.not.real.0@gmail.com", "testusernotreal0+tag@gmail.com")).toBe("testusernotreal0+tag@gmail.com");
    expect(deliveryAddress("TestUserNotReal0@googlemail.com", "test.user.not.real.0+tag@gmail.com")).toBe("test.user.not.real.0+tag@gmail.com");
    expect(deliveryAddress("testusernotreal1@gmail.com", "testusernotreal0+tag@gmail.com")).toBe("testusernotreal1@gmail.com");
  });

  it("masks the delivery address for Settings", () => {
    expect(maskAddress("owner+tag@example.com")).toBe("ow•••+tag@example.com");
    expect(maskAddress("someone@example.com")).toBe("so•••@example.com");
    expect(maskAddress("abc@example.com")).toBe("a•••@example.com");
    expect(maskAddress("not an address")).toBe("•••");
  });

  it("is set up only with both settings", () => {
    expect(emailSetup(ENV)).toEqual({ apiKey: KEY, notifyTo: TO });
    expect(emailSetup({ RESEND_API_KEY: KEY })).toBeNull();
    expect(emailSetup({ NOTIFY_EMAIL_TO: TO })).toBeNull();
    expect(emailSetup({ RESEND_API_KEY: " ", NOTIFY_EMAIL_TO: TO })).toBeNull();
    expect(emailSetup({ RESEND_API_KEY: KEY, NOTIFY_EMAIL_TO: "not-an-address" })).toBeNull();
  });
});

describe("renderEmail", () => {
  it("one item: the subject is hub · <what> · <when>, and the item links into the hub", () => {
    const { subject, text, html } = renderEmail(emailOf([renewal(30)]));
    expect(subject).toBe("hub · Insurance · Silver car ends 23 Dec");
    expect(text).toContain(`${appConfig.siteUrl}/vehicles/v1?item=renewal:r1`);
    expect(html).toContain(`href="${appConfig.siteUrl}/vehicles/v1?item=renewal:r1"`);
    expect(text).toContain("in 30 days");
  });

  it("several items: hub · N things coming up, one line and one link each", () => {
    const { subject, text, html } = renderEmail(emailOf([renewal(30), service(14), electricity(7)]));
    expect(subject).toBe("hub · 3 things coming up");
    for (const href of ["/vehicles/v1?item=renewal:r1", "/vehicles/v1?item=service:s1", "/bills#electricity-bill-e1"]) {
      expect(text).toContain(`${appConfig.siteUrl}${href}`);
      expect(html).toContain(`${appConfig.siteUrl}${href}`);
    }
  });

  it("has the footer linking to Settings › Notifications", () => {
    const { text, html } = renderEmail(emailOf([renewal(30)]));
    expect(text).toContain(`Change these in Settings › Notifications: ${appConfig.siteUrl}/settings/notifications`);
    expect(html).toMatch(new RegExp(`<a href="${appConfig.siteUrl}/settings/notifications"[^>]*>Change these in Settings › Notifications</a>`));
  });

  it("carries no amount, no account or plate, no images and no tracking", () => {
    const { subject, text, html } = renderEmail(emailOf([electricity(7), renewal(30)]));
    for (const part of [subject, text, html]) {
      expect(part).not.toContain("LKR");
      expect(part).not.toContain("4,250");
      expect(part).not.toContain("DEMO-0001");
    }
    expect(html).not.toMatch(/<img|background-image|url\(/i);
  });

  it("escapes names the owner typed", () => {
    const evil = `<script>alert("x")</script> & 'Bob's' "car"`;
    const { subject, text, html } = renderEmail(emailOf([renewal(30, evil)]));
    expect(html).not.toContain("<script>");
    expect(html).toContain(escapeHtml(defuseLinks(evil)));
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/​script&gt; &amp; &#39;Bob&#39;s&#39; &quot;car&quot;");
    // Plain text and the subject are not HTML: they keep the words as typed (the text part defused).
    expect(text).toContain(defuseLinks(evil));
    expect(subject).toContain(evil);
  });

  it("defuses URL-like names so Gmail cannot auto-link them", () => {
    const sneaky = "evil.example/login: http://x.test";
    const { text, html } = renderEmail(emailOf([renewal(30, sneaky)]));
    expect(defuseLinks(sneaky)).toBe("evil.​example/​login:​ http:​/​/​x.​test");
    for (const part of [text, html]) {
      expect(part).not.toContain("evil.example");
      expect(part).not.toContain("http://x.test");
      expect(part).toContain(defuseLinks(sneaky));
    }
    // The hub's own links stay whole.
    expect(html).toContain(`href="${appConfig.siteUrl}/vehicles/v1?item=renewal:r1"`);
    expect(text).toContain(`${appConfig.siteUrl}/vehicles/v1?item=renewal:r1`);
  });

  it("keeps the subject on one line, without C0 or C1 control characters", () => {
    const { subject } = renderEmail(emailOf([renewal(30, "Line\r\nBcc: someone@example.com\u0085x\u009by")]));
    expect(subject).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
    expect(oneLine("a\u0080b\u009fc\u0007d")).toBe("a b c d");
  });

  it("a system notice (iPhone stopped accepting pushes) has its own heading and body, not 'Coming up'", () => {
    const body = "iPhone stopped accepting pushes from hub, so it was removed. Turn pushes on again in Settings › Notifications.";
    const message = systemMessage({
      recipient: OWNER,
      channel: "email",
      kind: "push-gone",
      dedupeKey: "push-gone:d1",
      title: "iPhone stopped accepting pushes",
      body,
      href: "/settings/notifications",
      today: TODAY,
    });
    const { subject, text, html } = renderEmail(message);
    expect(subject).toBe("hub · iPhone stopped accepting pushes");
    expect(html).toContain(">iPhone stopped accepting pushes</h1>");
    expect(html).toContain(escapeHtml(defuseLinks(body)));
    expect(html).not.toContain("Coming up");
    expect(html).not.toContain("Today");
    expect(text.startsWith("iPhone stopped accepting pushes\n\n")).toBe(true);
    expect(text).not.toMatch(/\(today\)/i);

    // Batched with a plan-ahead notice: the planner line says when, the system line says its body.
    const mixed = renderEmail({ ...message, notices: [...emailOf([renewal(30)]).notices, ...message.notices] });
    expect(mixed.html).toContain("2 things coming up");
    expect(mixed.html).toContain("In 30 days");
    expect(mixed.html).toContain(escapeHtml(defuseLinks(body)));
  });

  it("the test email has the fixed subject", () => {
    const { subject, text, html } = renderTestEmail();
    expect(subject).toBe("hub · Test");
    expect(text).toContain(`${appConfig.siteUrl}/settings/notifications`);
    expect(html).toContain("<title>hub · Test</title>");
  });
});

describe("idempotency key", () => {
  it("is stable for the same notices, at most 256 characters and never holds the address", () => {
    const a = noticeIdempotencyKey(TO, TODAY, ["b", "a"]);
    expect(a).toBe(noticeIdempotencyKey(TO, TODAY, ["a", "b"]));
    expect(a).toMatch(/^hub-email\/[0-9a-f]{32}$/);
    expect(a.length).toBeLessThanOrEqual(256);
    expect(a).not.toContain("example");
    expect(noticeIdempotencyKey(TO, addDays(TODAY, 1), ["a", "b"])).not.toBe(a);
    expect(noticeIdempotencyKey("second@example.com", TODAY, ["a", "b"])).not.toBe(a);
    expect(testIdempotencyKey(TO, MORNING)).toMatch(/^hub-email-test\/[0-9a-f]{32}$/);
  });
});

describe("postToResend and the sender", () => {
  const setup = { apiKey: KEY, notifyTo: TO };
  const email = { ...renderTestEmail(), to: TO, idempotencyKey: "hub-email-test/abc" };

  it("posts to Resend with the key, the From, the idempotency key and both bodies", async () => {
    const f = okFetch();
    await postToResend(setup, email, { fetch: f });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe(RESEND_URL);
    expect(f.mock.calls[0][1]?.method).toBe("POST");
    expect(headersOf(f)).toMatchObject({ Authorization: `Bearer ${KEY}`, "Idempotency-Key": "hub-email-test/abc", "Content-Type": "application/json" });
    expect(f.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    const body = bodyOf(f);
    expect(body.from).toBe("hub <notify@mail.hub.anujajay.com>");
    expect(body.to).toEqual([TO]);
    expect(body.subject).toBe("hub · Test");
    expect(typeof body.text).toBe("string");
    expect(typeof body.html).toBe("string");
  });

  it.each([400, 401, 403, 404, 422, 429])("a %i is a known refusal (NotSentError) without the key or any address", async (status) => {
    const f = vi.fn(async () =>
      Response.json({ statusCode: status, name: "validation_error", message: `Bad ${TO} and other@example.org with ${KEY}` }, { status }),
    );
    const err = await postToResend(setup, email, { fetch: f }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotSentError);
    const message = (err as Error).message;
    expect(message).toContain(String(status));
    expect(message).toContain("validation_error");
    expect(message).not.toContain(KEY);
    expect(message).not.toMatch(/@/);
  });

  it("a 409 (the same idempotent request in progress, or the key reused) is an unknown outcome, never retried", async () => {
    const f = vi.fn(async () => Response.json({ name: "concurrent_idempotent_requests", message: `for ${TO}` }, { status: 409 }));
    const err = await postToResend(setup, email, { fetch: f }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(NotSentError);
    expect((err as Error).message).toMatch(/^Resend answered 409/);
    expect((err as Error).message).not.toMatch(/@/);
  });

  it.each([500, 502, 503])("a %i is an unknown outcome (not NotSentError)", async (status) => {
    const f = vi.fn(async () => new Response("oops owner@example.com", { status }));
    const err = await postToResend(setup, email, { fetch: f }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(NotSentError);
    expect((err as Error).message).toBe(`Resend answered ${status}`);
  });

  it("a timeout is an unknown outcome", async () => {
    const f = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const err = await postToResend(setup, email, { fetch: f as unknown as typeof fetch, timeoutMs: 20 }).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(NotSentError);
    expect((err as Error).message).toMatch(/did not answer/);
  });

  it("a network error is an unknown outcome without the error's own words", async () => {
    const f = vi.fn(async () => {
      throw new TypeError(`fetch failed for ${TO}`);
    });
    const err = await postToResend(setup, email, { fetch: f }).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(NotSentError);
    expect((err as Error).message).toBe("Could not reach Resend (network error)");
  });

  it("scrubs addresses and keys from any text", () => {
    expect(scrubSecrets(`to ${TO}, key ${KEY}, Bearer abc.def`, [KEY, TO])).toBe("to [hidden], key [hidden], Bearer [hidden]");
    expect(scrubSecrets("x <someone.else+tag@example.org> re_FAKE_other_9")).toBe("x <[address]> [key]");
  });

  it("the sender routes to NOTIFY_EMAIL_TO and keys by recipient, the run's day and notices", async () => {
    const f = okFetch();
    // A made-up Gmail owner: only Gmail ignores the +tag, so only there is the tagged address the same mailbox.
    const gmailTo = "testusernotreal0+tag@gmail.com";
    const sender = emailSender(() => ({ ...ENV, NOTIFY_EMAIL_TO: gmailTo }), { fetch: f });
    expect(sender.implemented).toBe(true);
    const message = emailOf([renewal(30)], "testusernotreal0@gmail.com");
    await sender.send(message, { today: TODAY });
    expect(bodyOf(f).to).toEqual([gmailTo]);
    expect(headersOf(f)["Idempotency-Key"]).toBe(noticeIdempotencyKey(gmailTo, TODAY, message.notices.map((n) => n.dedupeKey)));

    // The day comes from the run, not the sender's clock.
    await sender.send(message, { today: "2027-01-02" });
    expect(headersOf(f, 1)["Idempotency-Key"]).toBe(noticeIdempotencyKey(gmailTo, "2027-01-02", message.notices.map((n) => n.dedupeKey)));

    await sender.send(emailOf([renewal(30)], "second@example.com"), { today: TODAY });
    expect(bodyOf(f, 2).to).toEqual(["second@example.com"]);
  });

  it("logs nothing while sending, even on failure", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const sender = emailSender(() => ENV, { fetch: vi.fn(async () => new Response("", { status: 500 })) });
    await sender.send(emailOf([renewal(30)])).catch(() => {});
    for (const s of spies) expect(s).not.toHaveBeenCalled();
    for (const s of spies) s.mockRestore();
  });
});

describe("the live switch", () => {
  it("the email channel is live only with both settings AND the switch on", () => {
    const configured = emailSender(() => ENV);
    const missing = emailSender(() => ({ RESEND_API_KEY: KEY }));
    const push = SENDERS.push;
    const on = parseSwitches({ email: { enabled: true } });
    const off = parseSwitches({ email: { enabled: false } });
    expect(channelModes(on, { email: configured, push }).email).toBe("live");
    expect(channelModes(off, { email: configured, push }).email).toBe("dry");
    expect(channelModes(parseSwitches(null), { email: configured, push }).email).toBe("dry");
    expect(channelModes(on, { email: missing, push }).email).toBe("dry");
  });

  it("reads the settings when asked, not when loaded", () => {
    const env: Record<string, string | undefined> = {};
    const sender = emailSender(() => env);
    expect(sender.implemented).toBe(false);
    Object.assign(env, ENV);
    expect(sender.implemented).toBe(true);
  });

  it("a sender with no settings refuses (nothing sent) without calling Resend", async () => {
    const f = okFetch();
    const err = await emailSender(() => ({}), { fetch: f })
      .send(emailOf([renewal(30)]))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotSentError);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("Settings › Notifications › Email", () => {
  it("the status query checks the owner before reading the database", () => {
    const source = readFileSync(path.join("src", "features", "notifications", "email-settings.ts"), "utf8");
    const body = source.split("export async function getEmailStatus(")[1] ?? "";
    expect(body).toMatch(/await requirePage\("owner"\)/);
    expect(body.indexOf('requirePage("owner")')).toBeLessThan(body.indexOf("readDb()"));
  });

  it("the actions are owner only and log no more than an error's name", () => {
    const source = readFileSync(path.join("src", "features", "notifications", "email-actions.ts"), "utf8");
    for (const fn of ["setEmailEnabled", "sendTestEmail"]) {
      const body = source.split(`export async function ${fn}(`)[1]?.split(/\n}\n/)[0] ?? "";
      expect(body, fn).toMatch(/await requireUser\("owner"\);/);
    }
    for (const m of source.matchAll(/console\.(?:log|info|warn|error)\(([^;]*)\);/g)) expect(m[1]).toMatch(/safeErrorSummary\(err\)/);
  });
});

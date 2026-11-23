import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { appConfig } from "@/config/app.config";
import type { ReminderItem } from "@/features/reminders/engine";
import { addDays } from "@/lib/dates";
import { channelModes, NotSentError, parseSwitches, SENDERS } from "./channels";
import {
  deliveryAddress,
  emailSender,
  emailSetup,
  escapeHtml,
  maskAddress,
  noticeIdempotencyKey,
  postToResend,
  RESEND_URL,
  renderEmail,
  renderTestEmail,
  scrubSecrets,
  testIdempotencyKey,
} from "./email";
import { planNotifications, type Message } from "./planner";

// Everything here is made up (public repo): example.com addresses, a fake key.
const KEY = "re_FAKE_test_key_123456";
const TO = "owner+hub@example.com";
const OWNER = "owner@example.com";
const ENV = { RESEND_API_KEY: KEY, NOTIFY_EMAIL_TO: TO };
const TODAY = "2026-11-23";
const MORNING = new Date(`${TODAY}T02:10:00Z`);

function renewal(days: number, who = "Silver car", id = "renewal:r1"): ReminderItem {
  return { id, title: `Insurance · ${who}`, dueDate: addDays(TODAY, days), href: "/vehicles/v1?tab=renewals", kind: "renewal", notice: { what: "Insurance", who } };
}
function service(days: number, who = "Silver car"): ReminderItem {
  return { id: "service:s1", title: `Full service · ${who}`, dueDate: addDays(TODAY, days), href: "/vehicles/v1?tab=services", kind: "service", notice: { what: "Full service", who } };
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
  it("an owner whose address is NOTIFY_EMAIL_TO without the +tag gets it at NOTIFY_EMAIL_TO", () => {
    expect(deliveryAddress("owner@example.com", "owner+hub@example.com")).toBe("owner+hub@example.com");
    expect(deliveryAddress("Owner@Example.COM", "owner+hub@example.com")).toBe("owner+hub@example.com");
    expect(deliveryAddress("owner+other@example.com", "OWNER+hub@example.com")).toBe("OWNER+hub@example.com");
  });

  it("any other owner gets it at their own address", () => {
    expect(deliveryAddress("second@example.com", "owner+hub@example.com")).toBe("second@example.com");
    expect(deliveryAddress("owner@example.org", "owner+hub@example.com")).toBe("owner@example.org");
    expect(deliveryAddress("owners@example.com", "owner+hub@example.com")).toBe("owners@example.com");
  });

  it("masks the delivery address for Settings", () => {
    expect(maskAddress("owner+hub@example.com")).toBe("ow•••+hub@example.com");
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
    expect(text).toContain(`${appConfig.siteUrl}/vehicles/v1?tab=renewals`);
    expect(html).toContain(`href="${appConfig.siteUrl}/vehicles/v1?tab=renewals"`);
    expect(text).toContain("in 30 days");
  });

  it("several items: hub · N things coming up, one line and one link each", () => {
    const { subject, text, html } = renderEmail(emailOf([renewal(30), service(14), electricity(7)]));
    expect(subject).toBe("hub · 3 things coming up");
    for (const href of ["/vehicles/v1?tab=renewals", "/vehicles/v1?tab=services", "/bills#electricity-bill-e1"]) {
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
    expect(html).toContain(escapeHtml(evil));
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Bob&#39;s&#39; &quot;car&quot;");
    // Plain text and the subject are not HTML: they keep the words as typed.
    expect(text).toContain(evil);
    expect(subject).toContain(evil);
  });

  it("keeps the subject on one line", () => {
    const { subject } = renderEmail(emailOf([renewal(30, "Line\r\nBcc: someone@example.com")]));
    expect(subject).not.toMatch(/[\r\n]/);
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

  it.each([400, 401, 403, 404, 409, 422, 429])("a %i is a known refusal (NotSentError) without the key or any address", async (status) => {
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

  it("the sender routes to NOTIFY_EMAIL_TO and keys by recipient, day and notices", async () => {
    const f = okFetch();
    const sender = emailSender(() => ENV, { fetch: f, now: () => MORNING });
    expect(sender.implemented).toBe(true);
    const message = emailOf([renewal(30)]);
    await sender.send(message);
    expect(bodyOf(f).to).toEqual([TO]);
    expect(headersOf(f)["Idempotency-Key"]).toBe(noticeIdempotencyKey(TO, TODAY, message.notices.map((n) => n.dedupeKey)));

    await sender.send(emailOf([renewal(30)], "second@example.com"));
    expect(bodyOf(f, 1).to).toEqual(["second@example.com"]);
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

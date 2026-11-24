"use server";

import { sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { AuthError, requireUser } from "@/lib/auth";
import { safeErrorSummary } from "@/lib/errors";
import { NotSentError } from "./channels";
import { deliveryAddress, emailSetup, maskAddress, postToResend, renderTestEmail, testIdempotencyKey } from "./email";
import { saveSwitch } from "./switches";

// Settings › Notifications › Email (N.2, C141). Server Actions are public endpoints: owner only, inputs checked.

export type EmailActionResult = { ok: boolean; error?: string };
export type TestEmailResult = { outcome: "sent" | "refused" | "unknown" | "not-allowed"; message: string };

/** The app_settings row that limits "Send a test email" to one a minute (for the whole hub). */
const TEST_LIMIT_KEY = "notifications-email-test";
const TEST_EVERY_MS = 60_000;

/** Switches the plan-ahead email on or off. Turning it on needs both settings; off always works. */
export async function setEmailEnabled(fd: FormData): Promise<EmailActionResult> {
  try {
    await requireUser("owner");
    const raw = fd.get("enabled");
    if (raw !== "true" && raw !== "false") return { ok: false, error: "Could not read the switch." };
    const enabled = raw === "true";
    if (enabled && !emailSetup(process.env)) return { ok: false, error: "Email is not set up yet." };
    // Merged in one statement, so the iPhone switch (N.3) is never overwritten (switches.ts).
    await saveSwitch(db, "email", enabled);
    refresh();
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    console.error(`Saving the email switch failed: ${safeErrorSummary(err)}`);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Sends one test email (subject "hub · Test") to where this owner's notices go. At most one a minute:
 * the limit is claimed in the database first, so two clicks or two tabs cannot both send. Works while
 * the switch is off, so the owner can check delivery and the Gmail filter before switching on.
 */
export async function sendTestEmail(): Promise<TestEmailResult> {
  try {
    const { email } = await requireUser("owner");
    const setup = emailSetup(process.env);
    if (!setup) return { outcome: "refused", message: "Email is not set up yet." };

    const now = new Date();
    const claimed = await db
      .insert(appSettings)
      .values({ key: TEST_LIMIT_KEY, value: { at: now.toISOString() }, updatedAt: now })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: { at: now.toISOString() }, updatedAt: now },
        setWhere: sql`${appSettings.updatedAt} < ${new Date(now.getTime() - TEST_EVERY_MS).toISOString()}`,
      })
      .returning({ key: appSettings.key });
    if (claimed.length === 0) return { outcome: "not-allowed", message: "One test a minute. Try again shortly." };

    const to = deliveryAddress(email.trim().toLowerCase(), setup.notifyTo);
    try {
      await postToResend(setup, { ...renderTestEmail(), to, idempotencyKey: testIdempotencyKey(to, now) });
    } catch (err) {
      // The messages from postToResend never carry the key, the address or the body.
      if (err instanceof NotSentError) return { outcome: "refused", message: `Not sent. ${err.message}.` };
      return { outcome: "unknown", message: `${err instanceof Error ? err.message : "No answer"}. It may still arrive.` };
    }
    return { outcome: "sent", message: `Sent to ${maskAddress(to)}. Check the inbox.` };
  } catch (err) {
    if (err instanceof AuthError) return { outcome: "not-allowed", message: err.message };
    console.error(`Test email failed: ${safeErrorSummary(err)}`);
    return { outcome: "unknown", message: "Something went wrong. Please try again." };
  }
}

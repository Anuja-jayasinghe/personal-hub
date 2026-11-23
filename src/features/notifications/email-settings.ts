import "server-only";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { readDb } from "@/db/read";
import { appSettings } from "@/db/schema";
import { getAuthState, requirePage } from "@/lib/auth";
import { NOTIFICATIONS_SETTINGS_KEY, parseSwitches } from "./channels";
import { deliveryAddress, emailSetup, maskAddress } from "./email";

/**
 * Settings › Notifications › Email (N.2, C141): whether email is set up, where it goes (masked) and the
 * switch. Owner only, checked here as well as by the page (a partial request can skip the layout).
 */
export type EmailStatus = {
  /** RESEND_API_KEY and NOTIFY_EMAIL_TO are both set. */
  configured: boolean;
  /** Where the viewing owner's emails go, masked (`na•••+hub@example.com`); null when not set up. */
  maskedTo: string | null;
  /** The owner's switch in `app_settings` › notifications › email (default off). */
  enabled: boolean;
};

export async function getEmailStatus(): Promise<EmailStatus> {
  await connection();
  await requirePage("owner");
  const state = await getAuthState();
  const viewer = state.status === "ok" ? state.email.trim().toLowerCase() : "";
  const db = await readDb();
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, NOTIFICATIONS_SETTINGS_KEY));
  const setup = emailSetup(process.env);
  return {
    configured: setup !== null,
    maskedTo: setup && viewer ? maskAddress(deliveryAddress(viewer, setup.notifyTo)) : null,
    enabled: parseSwitches(row?.value ?? null).email.enabled,
  };
}

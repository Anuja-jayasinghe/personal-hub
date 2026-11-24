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
  /**
   * "not-set-up": RESEND_API_KEY or NOTIFY_EMAIL_TO is missing (previews: they are Production only);
   * "no-address": both are set, but the viewer's own sign-in address could not be read;
   * "ready": set up, with the masked delivery address.
   */
  state: "not-set-up" | "no-address" | "ready";
  /** Where the viewing owner's emails go, masked (`na•••+tag@example.com`); null unless "ready". */
  maskedTo: string | null;
  /** The owner's switch in `app_settings` › notifications › email (default off). */
  enabled: boolean;
};

const looksLikeAddress = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export async function getEmailStatus(): Promise<EmailStatus> {
  await connection();
  await requirePage("owner");
  const state = await getAuthState();
  const viewer = state.status === "ok" ? state.email.trim().toLowerCase() : "";
  const db = await readDb();
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, NOTIFICATIONS_SETTINGS_KEY));
  const enabled = parseSwitches(row?.value ?? null).email.enabled;
  const setup = emailSetup(process.env);
  if (!setup) return { state: "not-set-up", maskedTo: null, enabled };
  if (!looksLikeAddress(viewer)) return { state: "no-address", maskedTo: null, enabled };
  return { state: "ready", maskedTo: maskAddress(deliveryAddress(viewer, setup.notifyTo)), enabled };
}

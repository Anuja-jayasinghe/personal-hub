import "server-only";
import type { Db } from "@/db/read";
import { parseAllowedEmails } from "@/lib/allowed-emails";
import type { ChannelSender } from "./channels";
import { emailSender } from "./email";
import { vapidFromEnv } from "./push/config";
import { createPushSender } from "./push/sender";
import { webPushTransport } from "./push/transport";
import type { Channel } from "./steps";

/**
 * The senders the daily run and the push Server Actions use (Notifications N.3, C140), built in ONE
 * place. Email is the real Resend sender (N.2, C141), implemented only while RESEND_API_KEY and
 * NOTIFY_EMAIL_TO are set; the push sender (which carries the "stopped accepting pushes" email notice)
 * gets that same email sender. Push is implemented only when the VAPID keys are set. Each channel goes
 * live only when the owner also switched it on in Settings. The database is passed in; this file never
 * picks one.
 */
export function buildSenders(db: Db, options: { onlyEndpointHash?: string } = {}): Record<Channel, ChannelSender> {
  const email = emailSender();
  const vapid = vapidFromEnv();
  // Email goes to the owners only (N.5, C144): the "stopped accepting pushes" email is never written for a person.
  const owners = new Set(parseAllowedEmails(process.env.ALLOWED_EMAILS));
  const push = createPushSender({
    db,
    transport: vapid ? webPushTransport(vapid) : null,
    emailSender: email,
    onlyEndpointHash: options.onlyEndpointHash,
    canEmail: (recipient) => owners.has(recipient.trim().toLowerCase()),
  });
  return { email, push };
}

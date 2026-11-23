import "server-only";
import type { Db } from "@/db/read";
import { SENDERS, type ChannelSender } from "./channels";
import { vapidFromEnv } from "./push/config";
import { createPushSender } from "./push/sender";
import { webPushTransport } from "./push/transport";
import type { Channel } from "./steps";

/**
 * The senders the daily run and the push Server Actions use (Notifications N.3, C140), built in ONE
 * place: N.2 replaces the email line with the real email sender, and the push sender (which carries the
 * "stopped accepting pushes" email notice) gets it from here too. Push is implemented only when the
 * VAPID keys are set; each channel goes live only when the owner also switched it on in Settings.
 * The database is passed in; this file never picks one.
 */
export function buildSenders(db: Db, options: { onlyEndpointHash?: string } = {}): Record<Channel, ChannelSender> {
  const email = SENDERS.email;
  const vapid = vapidFromEnv();
  const push = createPushSender({ db, transport: vapid ? webPushTransport(vapid) : null, emailSender: email, onlyEndpointHash: options.onlyEndpointHash });
  return { email, push };
}

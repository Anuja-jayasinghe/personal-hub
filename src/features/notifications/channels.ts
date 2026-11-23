import type { Message } from "./planner";
import type { Channel } from "./steps";

/**
 * The ways a notification leaves the hub (Notifications N.1, C139): email (N.2, Resend) and an iPhone
 * push (N.3, web push). Until a channel is built and set up, the run is a dry run for it: it writes the
 * send log with status `dry_run` and nothing leaves the server. A channel only goes live when it is both
 * implemented and switched on in Settings (`app_settings`, key "notifications", default off). Pure.
 * Push is built (src/features/notifications/push, C140) but needs the database and the VAPID keys, so
 * run.ts creates it; `SENDERS.push` below is what stands in when the keys are missing.
 */

/**
 * Thrown by a sender when it KNOWS nothing went out (the provider refused the message, a bad address).
 * The rows are stamped `failed` and the notice may be retried on a later run while still timely. Any
 * other error is an unknown outcome: the rows stay `pending` and are never sent again.
 */
export class NotSentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotSentError";
  }
}

export type ChannelSender = {
  channel: Channel;
  /** False until N.2 (email) / N.3 (push) build the real sender. */
  implemented: boolean;
  /** Sends one batched message. Throws `NotSentError` when nothing went out, anything else when unsure. */
  send: (message: Message) => Promise<void>;
};

function notBuiltYet(channel: Channel, piece: string): ChannelSender {
  return {
    channel,
    implemented: false,
    async send() {
      throw new NotSentError(`The ${channel} channel is not set up yet (${piece}).`);
    },
  };
}

export const SENDERS: Record<Channel, ChannelSender> = {
  email: notBuiltYet("email", "N.2"),
  push: notBuiltYet("push", "N.3"),
};

export const NOTIFICATIONS_SETTINGS_KEY = "notifications";

/** The on/off switches saved in `app_settings` under "notifications". */
export type NotificationSwitches = Record<Channel, { enabled: boolean }>;

/** Reads the saved switches; anything missing or malformed is off. */
export function parseSwitches(value: unknown): NotificationSwitches {
  const on = (channel: Channel) => {
    if (!value || typeof value !== "object") return false;
    const entry = (value as Record<string, unknown>)[channel];
    return !!entry && typeof entry === "object" && (entry as Record<string, unknown>).enabled === true;
  };
  return { email: { enabled: on("email") }, push: { enabled: on("push") } };
}

export type ChannelMode = "dry" | "live";
export type ChannelModes = Record<Channel, ChannelMode>;

/** Live only when the sender exists AND the owner switched it on; otherwise a dry run. */
export function channelModes(switches: NotificationSwitches, senders: Record<Channel, Pick<ChannelSender, "implemented">> = SENDERS): ChannelModes {
  const mode = (c: Channel): ChannelMode => (senders[c].implemented && switches[c].enabled ? "live" : "dry");
  return { email: mode("email"), push: mode("push") };
}

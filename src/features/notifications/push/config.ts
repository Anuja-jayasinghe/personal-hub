/**
 * The VAPID settings iPhone push needs (Notifications N.3, DECISIONS C140). Pure: the environment is
 * passed in. If any of the three is missing or malformed, push is "not set up": the channel stays a
 * dry run whatever the switch says, and Settings cannot turn it on.
 *
 *  - NEXT_PUBLIC_VAPID_PUBLIC_KEY: the public half, which the browser needs to subscribe (public by design);
 *  - VAPID_PRIVATE_KEY: the private half, which signs every push (secret, server only);
 *  - VAPID_SUBJECT: how a push service can reach the sender, the hub's address (never a personal email).
 */
export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

type VapidEnv = { NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string };

const BASE64URL = /^[A-Za-z0-9_-]+$/;

export function vapidFrom(env: VapidEnv): VapidConfig | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = env.VAPID_SUBJECT?.trim() ?? "";
  // A P-256 public key is 65 bytes (87 characters), the private key 32 bytes (43).
  if (!BASE64URL.test(publicKey) || publicKey.length !== 87) return null;
  if (!BASE64URL.test(privateKey) || privateKey.length !== 43) return null;
  if (!/^https:\/\/[^\s/]+/.test(subject) && !/^mailto:\S+@\S+$/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}

/**
 * Read where it is used. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must be written out in full for Next.js to put
 * it in the browser bundle; the private key is only ever read on the server.
 */
export function vapidFromEnv(): VapidConfig | null {
  return vapidFrom({
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  });
}

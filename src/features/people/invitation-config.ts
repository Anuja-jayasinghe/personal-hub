/**
 * The invitation rules in one place (issue #236, DECISIONS C154). Pure: no database, no clock.
 * Owner-only already limits who can invite; the caps below stop mistakes and loops.
 */
const HOUR_MS = 60 * 60 * 1000;

export const INVITATION_LIMITS = {
  /** An invitation can be used for this many days after it was sent (the owner's choice). */
  expiryDays: 14,
  /** The same invitation cannot be sent again within this long. */
  resendCooldownMs: HOUR_MS,
  /** At most this many sends (the first and the resends) per person in total. */
  maxSendsPerPerson: 5,
  /** At most this many invitations and resends per owner per calendar day, all people together. */
  maxPerOwnerPerDay: 10,
  /** The same address cannot be invited a second time within this long (use Resend, after the cooldown). */
  sameAddressMs: 24 * HOUR_MS,
} as const;

/** The shape of a code the sign-up link can carry (anything else is ignored without a database read). */
export const INVITE_CODE_RE = /^[A-Za-z0-9_-]{22}$/;

export const INVITATION_STATUSES = ["invited", "expired"] as const;

/** True for a person row that is only a waiting placeholder: it has no power until they sign in. */
export function isInvitationStatus(status: string): status is (typeof INVITATION_STATUSES)[number] {
  return status === "invited" || status === "expired";
}

/** When an invitation sent at `now` ends. */
export function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_LIMITS.expiryDays * 24 * HOUR_MS);
}

export type ResendState = { ok: true } | { ok: false; reason: "not-waiting" | "cap" | "cooldown"; retryAt?: Date };

/** The words for "not yet": the cooldown and the cap, shared by the action's message and the list. */
export function resendRefusal(state: Extract<ResendState, { ok: false }>, now: Date): string {
  if (state.reason === "cap") return `This invitation has been sent ${INVITATION_LIMITS.maxSendsPerPerson} times already. Withdraw it and invite them again if you need to.`;
  if (state.reason === "cooldown" && state.retryAt) {
    const minutes = Math.max(1, Math.ceil((state.retryAt.getTime() - now.getTime()) / 60_000));
    return `It was sent a moment ago. You can send it again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
  }
  return "Only an invitation that is waiting can be sent again.";
}

/** May this waiting person be sent the invitation again right now? Shared by the action and the list. */
export function resendAvailability(person: { status: string; inviteSentAt: Date | null; inviteSendCount: number }, now: Date): ResendState {
  if (!isInvitationStatus(person.status)) return { ok: false, reason: "not-waiting" };
  if (person.inviteSendCount >= INVITATION_LIMITS.maxSendsPerPerson) return { ok: false, reason: "cap" };
  if (person.inviteSentAt) {
    const retryAt = new Date(person.inviteSentAt.getTime() + INVITATION_LIMITS.resendCooldownMs);
    if (retryAt.getTime() > now.getTime()) return { ok: false, reason: "cooldown", retryAt };
  }
  return { ok: true };
}

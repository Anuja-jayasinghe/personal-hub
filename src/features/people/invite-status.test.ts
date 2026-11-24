import { describe, expect, it } from "vitest";
import { INVITATION_LIMITS, invitationExpiry, isInvitationStatus, resendAvailability } from "./invitation-config";
import { agoText, inText, inviteView, type InviteRow } from "./invite-status";

const DAY = 86_400_000;
const NOW = new Date("2026-11-24T04:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const row = (over: Partial<InviteRow> = {}): InviteRow => ({
  status: "invited",
  inviteSentAt: ago(3 * DAY),
  inviteExpiresAt: new Date(NOW.getTime() + 11 * DAY),
  inviteOpenedAt: null,
  inviteSendCount: 1,
  ...over,
});

describe("the people list states", () => {
  it("an invitation: sent 3 days ago, ends in 11 days, not opened yet, Resend allowed", () => {
    expect(inviteView(row(), NOW)).toEqual({ ended: false, line: "Invited · sent 3 days ago · ends in 11 days", opened: "Not opened yet", canResend: true, resendNote: null });
  });

  it("shows Opened when the link was opened", () => {
    expect(inviteView(row({ inviteOpenedAt: ago(DAY) }), NOW).opened).toBe("Opened");
  });

  it("explains the cooldown and counts the minutes", () => {
    const view = inviteView(row({ inviteSentAt: ago(20 * 60_000) }), NOW);
    expect(view.canResend).toBe(false);
    expect(view.line).toContain("sent 20 minutes ago");
    expect(view.resendNote).toBe("It was sent a moment ago. You can send it again in 40 minutes.");
  });

  it("explains the cap", () => {
    const view = inviteView(row({ inviteSendCount: 5 }), NOW);
    expect(view.canResend).toBe(false);
    expect(view.resendNote).toMatch(/5 times already/);
  });

  it("an expired person says so and can be resent (when under the cap and past the cooldown)", () => {
    const view = inviteView(row({ status: "expired", inviteExpiresAt: ago(2 * DAY) }), NOW);
    expect(view).toMatchObject({ ended: true, line: "Expired · ended 2 days ago", canResend: true });
  });

  it("an invitation past its end shows as expired even before anyone has signed in to flip it", () => {
    expect(inviteView(row({ inviteExpiresAt: ago(1000) }), NOW).ended).toBe(true);
    expect(inviteView(row({ inviteExpiresAt: NOW }), NOW).ended).toBe(true);
  });

  it("an invitation whose email never left says so", () => {
    expect(inviteView(row({ inviteSentAt: null }), NOW).line).toBe("Invited · not sent yet · ends in 11 days");
  });

  it("time words are plain", () => {
    expect(agoText(ago(10_000), NOW)).toBe("just now");
    expect(agoText(ago(60_000), NOW)).toBe("1 minute ago");
    expect(agoText(ago(3 * 3_600_000), NOW)).toBe("3 hours ago");
    expect(agoText(ago(DAY), NOW)).toBe("1 day ago");
    expect(inText(new Date(NOW.getTime() + 600_000), NOW)).toBe("in under an hour");
    expect(inText(new Date(NOW.getTime() + 5 * 3_600_000), NOW)).toBe("in 5 hours");
    expect(inText(new Date(NOW.getTime() + DAY), NOW)).toBe("in 1 day");
  });
});

describe("the rules", () => {
  it("are the owner's choices", () => {
    expect(INVITATION_LIMITS).toEqual({ expiryDays: 14, resendCooldownMs: 3_600_000, maxSendsPerPerson: 5, maxPerOwnerPerDay: 10, sameAddressMs: 86_400_000 });
    expect(invitationExpiry(NOW).getTime()).toBe(NOW.getTime() + 14 * DAY);
  });

  it("resend is only for invited and expired people", () => {
    for (const status of ["pending", "active", "blocked"]) expect(resendAvailability({ status, inviteSentAt: null, inviteSendCount: 0 }, NOW)).toEqual({ ok: false, reason: "not-waiting" });
    expect(isInvitationStatus("invited") && isInvitationStatus("expired")).toBe(true);
    expect(isInvitationStatus("active") || isInvitationStatus("pending") || isInvitationStatus("blocked")).toBe(false);
    expect(resendAvailability({ status: "invited", inviteSentAt: ago(INVITATION_LIMITS.resendCooldownMs), inviteSendCount: 1 }, NOW)).toEqual({ ok: true });
  });
});

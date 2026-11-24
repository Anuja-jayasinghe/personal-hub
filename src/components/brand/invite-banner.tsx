import { appConfig } from "@/config/app.config";
import { invitationBannerFor } from "@/features/people/invite-banner";

/**
 * "<first name> invited you to hub", above the sign-up form, when the link carries a valid invitation
 * code (issue #236, DECISIONS C154). It shows a first name and nothing else: never an email address, and
 * an unknown, expired or malformed code renders nothing at all, exactly like no code.
 */
export async function InviteBanner({ searchParams }: { searchParams: Promise<{ invite?: string | string[] }> }) {
  const { invite } = await searchParams;
  const banner = await invitationBannerFor(Array.isArray(invite) ? invite[0] : invite);
  if (!banner) return null;
  return (
    <p role="status" className="rounded-xl border border-primary/40 bg-accent px-4 py-3 text-[15px] leading-snug">
      {banner.inviterName ? <strong className="font-semibold">{banner.inviterName}</strong> : null}
      {banner.inviterName ? ` invited you to ${appConfig.name}.` : `You have been invited to ${appConfig.name}.`}
    </p>
  );
}

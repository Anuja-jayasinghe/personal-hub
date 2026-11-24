import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteBanner } from "@/components/brand/invite-banner";
import { SignInFrame } from "@/components/brand/sign-in-frame";

export const metadata: Metadata = { title: "Sign up" };

/**
 * Where an invitation link lands (issue #236, DECISIONS C154): `/sign-up?invite=<code>` shows a short
 * welcome from whoever invited them above Clerk's own form, which is unchanged. Sign-up is open (C115) and
 * the hub does the gating in src/lib/auth.ts: an invited person becomes active only when they sign up
 * with the invited address, verified; anyone else just waits for approval.
 */
export default function SignUpPage(props: PageProps<"/sign-up/[[...sign-up]]">) {
  return (
    <main className="flex flex-1 flex-col">
      <SignInFrame crumb="Accept your invite" title="Join the hub." lead="Use the email address your invitation was sent to.">
        <Suspense fallback={null}>
          <InviteBanner searchParams={props.searchParams as Promise<{ invite?: string | string[] }>} />
        </Suspense>
        <SignUp />
      </SignInFrame>
    </main>
  );
}

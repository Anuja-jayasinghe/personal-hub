import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { SignInFrame } from "@/components/brand/sign-in-frame";

export const metadata: Metadata = { title: "Sign up" };

/**
 * Needed so an invitation link can be accepted. The Clerk app is set to invite-only, and even a
 * successful sign-up gets nothing unless the email is on ALLOWED_EMAILS (src/lib/auth.ts).
 */
export default function SignUpPage() {
  return (
    <main className="flex flex-1 flex-col">
      <SignInFrame crumb="Accept your invite" title="Join the hub." lead="Use the email address your invitation was sent to.">
        <SignUp />
      </SignInFrame>
    </main>
  );
}

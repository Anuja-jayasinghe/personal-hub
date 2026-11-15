import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign up" };

/**
 * Needed so an invitation link can be accepted. The Clerk app is set to invite-only, and even a
 * successful sign-up gets nothing unless the email is on ALLOWED_EMAILS (src/lib/auth.ts).
 */
export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <SignUp />
    </main>
  );
}

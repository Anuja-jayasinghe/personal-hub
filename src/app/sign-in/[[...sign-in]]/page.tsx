import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { SignInFrame } from "@/components/brand/sign-in-frame";

export const metadata: Metadata = { title: "Sign in" };

/** Sign in (boards HSignIn, HSignInPhone): Clerk's form inside the hub frame, styled by clerkAppearance. */
export default function SignInPage() {
  return (
    <main className="flex flex-1 flex-col">
      <SignInFrame crumb="Sign in" title="Welcome back." lead="Only people you invite can open the hub.">
        <SignIn />
      </SignInFrame>
    </main>
  );
}

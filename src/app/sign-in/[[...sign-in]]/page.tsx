import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

/** Clerk's sign-in form, outside the app shell. Only the owner's invited address gets through (C61). */
export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <SignIn />
    </main>
  );
}

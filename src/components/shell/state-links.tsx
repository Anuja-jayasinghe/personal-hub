"use client";

import { usePathname, useRouter } from "next/navigation";

/** "Go back" on the 404: the browser's back, or Home when there is nothing to go back to. */
export function GoBackButton({ className }: { className: string }) {
  const router = useRouter();
  return (
    <button type="button" className={className} onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}>
      Go back
    </button>
  );
}

/** The address that was asked for, shown on the 404 so you can see what was mistyped. */
export function RequestedPath() {
  const pathname = usePathname();
  return <>{pathname}</>;
}

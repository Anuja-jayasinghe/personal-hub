"use client";

import { useEffect } from "react";
import { RENEWALS_ANCHOR, SERVICES_ANCHOR } from "@/features/vehicles/tabs";

/**
 * Scrolls to the Services card or the renewal cards when the address ends in `#services` or `#renewals` (V.3, C150:
 * where an old `?tab=services` or `?tab=renewals` link lands). The Overview streams in after the page shell, so the
 * browser's own jump to a `#fragment` can run before the card exists; this runs once the cards are on the page.
 * Only the two known names are followed, never an arbitrary id from the address. Renders nothing.
 */
export function ScrollToAnchor() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id !== SERVICES_ANCHOR && id !== RENEWALS_ANCHOR) return;
    // The router can put the page back at the top once after it hydrates, so try again a moment later; a person who
    // has already scrolled is left where they are.
    const go = () => {
      if (window.scrollY < 1) document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    const timers = [0, 150, 600].map((ms) => window.setTimeout(go, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);
  return null;
}

/**
 * Is the hub running as an installed app (added to the Home Screen or installed from the browser), with no
 * browser around it? Chrome and Android say so through the `display-mode: standalone` media query, iOS Safari
 * through the old `navigator.standalone` flag. One place for it (Settings > Notifications and the touch
 * gestures of issue #176, C156, both ask). The pieces are injectable so every answer is tested without a browser.
 */
export type InstalledEnv = {
  matchMedia?: ((query: string) => { matches: boolean }) | null;
  navigator?: { standalone?: boolean } | null;
};

export function isInstalledApp(env?: InstalledEnv): boolean {
  const w: InstalledEnv =
    env ??
    (typeof window === "undefined"
      ? {}
      : { matchMedia: window.matchMedia?.bind(window), navigator: window.navigator as Navigator & { standalone?: boolean } });
  try {
    if (w.matchMedia?.("(display-mode: standalone)").matches) return true;
  } catch {
    // A browser that rejects the query: as far as we can tell, not installed.
  }
  return w.navigator?.standalone === true;
}

import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { securityHeaders } from "./security-headers";

const rules = async () => (await nextConfig.headers!()) as typeof securityHeaders;
const headerOf = (rule: { headers: { key: string; value: string }[] }, key: string) => rule.headers.find((h) => h.key === key)?.value;

describe("security headers (issue #207)", () => {
  it("next.config.ts serves the headers module", async () => {
    expect(await rules()).toEqual(securityHeaders);
  });

  it("sets the basics on every path", async () => {
    const all = (await rules()).find((r) => r.source === "/:path*");
    expect(all).toBeDefined();
    expect(headerOf(all!, "X-Content-Type-Options")).toBe("nosniff");
    expect(headerOf(all!, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerOf(all!, "X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    const permissions = headerOf(all!, "Permissions-Policy")!;
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) expect(permissions).toContain(`${feature}=()`);
  });

  it("forbids framing the pages, and lets only the hub frame its own file route", async () => {
    const list = await rules();
    const pages = list.find((r) => r.source.startsWith("/((?!files/"));
    expect(headerOf(pages!, "Content-Security-Policy")).toBe("frame-ancestors 'none'");
    expect(headerOf(pages!, "X-Frame-Options")).toBe("DENY");
    const files = list.find((r) => r.source === "/files/:path*");
    expect(headerOf(files!, "Content-Security-Policy")).toBe("frame-ancestors 'self'");
    expect(headerOf(files!, "X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("never sends HSTS includeSubDomains or preload (the host sets HSTS)", async () => {
    const all = JSON.stringify(await rules());
    expect(all).not.toMatch(/Strict-Transport-Security|includeSubDomains|preload/i);
  });

  it("keeps the service worker's no-store and CSP rules, and does not frame it", async () => {
    const sw = (await rules()).find((r) => r.source === "/sw.js");
    expect(headerOf(sw!, "Content-Type")).toBe("application/javascript; charset=utf-8");
    expect(headerOf(sw!, "Cache-Control")).toBe("no-cache, no-store, must-revalidate");
    const csp = headerOf(sw!, "Content-Security-Policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("does not set one header twice for the same path (the framing entries do not overlap)", async () => {
    const framing = (await rules()).filter((r) => r.headers.some((h) => h.key === "X-Frame-Options"));
    // /files is excluded from the page rule, /sw.js has its own: three entries, three distinct sources.
    expect(new Set(framing.map((r) => r.source)).size).toBe(3);
    const pages = framing.find((r) => r.source.startsWith("/((?!files/"))!;
    expect(pages.source).toContain("files/");
    expect(pages.source).toContain("sw");
  });
});

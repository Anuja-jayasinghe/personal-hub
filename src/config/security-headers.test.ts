import { describe, expect, it } from "vitest";
// Next compiles header sources with this same library, so the test matches paths the way the host does.
// @ts-expect-error -- Next ships this compiled copy without type declarations
import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
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
    expect(permissions).toContain("camera=(self)");
    for (const feature of ["microphone", "geolocation", "payment", "usb"]) expect(permissions).toContain(`${feature}=()`);
  });

  it("forbids framing the pages, and lets only the hub frame its own file route", async () => {
    const list = await rules();
    const pages = list.find((r) => r.source.startsWith("/((?!files"));
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

  it("matches each sample path with exactly one framing rule, and the intended one", async () => {
    const framing = (await rules()).filter((r) => r.headers.some((h) => h.key === "X-Frame-Options"));
    expect(framing).toHaveLength(3);
    const matches = (path: string) => framing.filter((r) => pathToRegexp(r.source).test(path));
    const frameOf = (path: string) => {
      const found = matches(path);
      expect(found, `${path} must match exactly one framing rule`).toHaveLength(1);
      return headerOf(found[0], "X-Frame-Options");
    };
    // Pages, the API and look-alikes of the two special paths: never framed.
    for (const path of ["/", "/vehicles", "/api/notify", "/sw.json", "/sw.js.map", "/filesystem", "/settings/people"]) expect(frameOf(path), path).toBe("DENY");
    // The file route: the hub may frame its own.
    for (const path of ["/files", "/files/x", "/files/00000000-0000-0000-0000-000000000000"]) expect(frameOf(path), path).toBe("SAMEORIGIN");
    // The service worker has its own rule (DENY too, with its own CSP).
    expect(matches("/sw.js")[0].source).toBe("/sw.js");
    expect(matches("/sw.js")).toHaveLength(1);
  });
});

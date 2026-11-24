import { describe, expect, it } from "vitest";
import { isInstalledApp } from "./installed-app";

const mm = (standalone: boolean) => (q: string) => ({ matches: standalone && q === "(display-mode: standalone)" });

describe("isInstalledApp", () => {
  it("is true when the display mode is standalone (Chrome, Android, desktop installs)", () => {
    expect(isInstalledApp({ matchMedia: mm(true), navigator: {} })).toBe(true);
  });
  it("is true for iOS Safari's navigator.standalone flag", () => {
    expect(isInstalledApp({ matchMedia: mm(false), navigator: { standalone: true } })).toBe(true);
  });
  it("is false in a normal browser tab", () => {
    expect(isInstalledApp({ matchMedia: mm(false), navigator: { standalone: false } })).toBe(false);
    expect(isInstalledApp({ matchMedia: mm(false), navigator: {} })).toBe(false);
  });
  it("is false when there is no matchMedia or navigator at all", () => {
    expect(isInstalledApp({})).toBe(false);
    expect(isInstalledApp({ matchMedia: null, navigator: null })).toBe(false);
  });
  it("is false (not a crash) when the browser rejects the query", () => {
    expect(
      isInstalledApp({
        matchMedia: () => {
          throw new Error("nope");
        },
      }),
    ).toBe(false);
  });
});

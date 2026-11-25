import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { appConfig } from "@/config/app.config";
import { version } from "../../../package.json";
import { Footer, releaseNotesUrl } from "./footer";

describe("releaseNotesUrl", () => {
  it("points at the GitHub release of that version", () => {
    expect(releaseNotesUrl("https://github.com/o/r", "1.2.3")).toBe("https://github.com/o/r/releases/tag/v1.2.3");
    expect(releaseNotesUrl("https://github.com/o/r/", "1.2.3")).toBe("https://github.com/o/r/releases/tag/v1.2.3");
  });
});

describe("Footer (issue #275)", () => {
  const html = renderToStaticMarkup(createElement(Footer));

  it("says who built it, with a link to the portfolio", () => {
    expect(html).toContain("Built by");
    expect(html).toContain(`href="${appConfig.author.url}"`);
    expect(html).toContain(appConfig.author.name);
  });

  it("shows the live version and links to its release notes", () => {
    expect(html).toContain(`v${version}`);
    expect(html).toContain(`href="${appConfig.repoUrl}/releases/tag/v${version}"`);
    expect(html).toContain("release notes");
  });

  it("has a labelled GitHub link, and every outside link is opened safely", () => {
    expect(html).toContain(`aria-label="${appConfig.author.name} on GitHub"`);
    expect(html).toContain(`href="${appConfig.author.github}"`);
    const links = html.match(/<a [^>]*>/g) ?? [];
    expect(links).toHaveLength(3);
    for (const a of links) {
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="noopener noreferrer"');
    }
  });

  it("is a footer landmark and carries no real personal data beyond the public author line", () => {
    expect(html.startsWith("<footer")).toBe(true);
    expect(html).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
  });
});

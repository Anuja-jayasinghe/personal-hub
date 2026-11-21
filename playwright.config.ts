import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (issue #139, DECISIONS C121): Playwright drives a real browser against a running hub,
 * by default the live site. They are the start of the CI/CD work (C120). Run with `pnpm e2e`.
 *
 * Settings come from .env.local: `E2E_BASE_URL` (default https://hub.anujajay.com), `E2E_CLERK_SECRET_KEY`
 * (the Clerk secret key of the instance that site uses, to create and sign in a TEST account) and
 * `DATABASE_URL` (to approve the TEST person and clean up). None of them is ever printed.
 */
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://hub.anujajay.com",
    // A failing run's trace and screenshots show the live site's real pages. Keep them on this machine
    // only (test-results/ is git-ignored): in GitHub Actions the repo is public, so CI keeps neither.
    trace: process.env.CI ? "off" : "retain-on-failure",
    screenshot: process.env.CI ? "off" : "only-on-failure",
  },
  outputDir: "test-results/e2e",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

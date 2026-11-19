import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Attachment uploads go through Server Actions; the default 1 MB limit is too small for bill
  // photos. 10 MB file limit (DECISIONS C33) + headroom for the multipart form overhead.
  experimental: {
    serverActions: { bodySizeLimit: "1mb" }, // files go straight to storage now (C115), not through actions
  },
  // Dev only (DECISIONS C11): let phones and other devices on the home Wi-Fi load the dev server.
  // Each `*` matches exactly one hostname label, so these cover 10.x.x.x, 192.168.x.x and *.local.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "*.local"],
  // Clerk (login, Phase 4.1): never contact Clerk on its own. "Keyless mode" would create a
  // temporary Clerk app by itself when no keys are set, and the SDK sends anonymous telemetry by
  // default; both are switched off so nothing reaches Clerk until you have created your own app.
  env: {
    NEXT_PUBLIC_CLERK_KEYLESS_DISABLED: "true",
    NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED: "1",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

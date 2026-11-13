import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Dev only (DECISIONS C11): let phones and other devices on the home Wi-Fi load the dev server.
  // Each `*` matches exactly one hostname label, so these cover 10.x.x.x, 192.168.x.x and *.local.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "*.local"],
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

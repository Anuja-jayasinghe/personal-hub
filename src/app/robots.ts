import type { MetadataRoute } from "next";

/** The hub is private (issue #207): ask every crawler to stay out. The `X-Robots-Tag` header says the same on every response. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}

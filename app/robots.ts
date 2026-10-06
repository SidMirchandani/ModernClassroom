import type { MetadataRoute } from "next";

/**
 * The marketing pages are for finding; everything behind a login is not.
 * Disallowing them is not a security measure — row-level security is — it just
 * keeps class URLs out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/dashboard/", "/demo"],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}

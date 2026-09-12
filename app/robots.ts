import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "https://foodbalance.com.ua";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/onboarding"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foodbalancetest-production.up.railway.app";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/onboarding"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next"

import { resolveSiteBaseUrl } from "@/lib/seo-site-url"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = resolveSiteBaseUrl()

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

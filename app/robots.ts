import type { MetadataRoute } from "next"

import { resolveSiteBaseUrl } from "@/lib/seo-site-url"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = resolveSiteBaseUrl()

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/shops", "/browse", "/browse/", "/sell", "/store/supplier/"],
        disallow: [
          "/dashboard/",
          "/admin/",
          "/api/",
          "/embed/",
          "/login/",
          "/signup/",
          "/store/supplier/*/product/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

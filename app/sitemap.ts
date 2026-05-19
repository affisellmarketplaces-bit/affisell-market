import type { MetadataRoute } from "next"

import { loadPublicAffiliateShopSlugs } from "@/lib/shop-storefront-data"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrlRaw =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3001"

  const baseUrl = baseUrlRaw.replace(/\/$/, "")

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/shops`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  ]

  let slugs: string[] = []
  try {
    slugs = await loadPublicAffiliateShopSlugs()
  } catch (err) {
    console.error("[sitemap] loadPublicAffiliateShopSlugs failed:", err)
  }

  const shopUrls: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${baseUrl}/shops/${encodeURIComponent(slug)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }))

  return [...staticEntries, ...shopUrls]
}

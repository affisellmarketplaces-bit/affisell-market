import type { MetadataRoute } from "next"

import { buildAffisellSitemap } from "@/lib/seo-sitemap"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildAffisellSitemap()
}

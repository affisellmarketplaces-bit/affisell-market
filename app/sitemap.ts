import type { MetadataRoute } from "next"

import {
  buildAffisellSitemapChunk,
  planAffisellSitemapChunks,
} from "@/lib/seo-sitemap"

export async function generateSitemaps() {
  const chunkIds = await planAffisellSitemapChunks()
  return chunkIds.map((id) => ({ id }))
}

export default async function sitemap(props: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id)
  if (!Number.isFinite(id) || id < 0) return []
  return buildAffisellSitemapChunk(id)
}

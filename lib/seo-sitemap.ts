import type { MetadataRoute } from "next"

import { shopListingPath, shopStorefrontPath } from "@/lib/affiliate-routes"
import { shouldQueryDatabaseDuringBuild } from "@/lib/build-time-database"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma, withPrismaReconnect } from "@/lib/prisma"
import { loadIndexableCategoryBrowseSlugs } from "@/lib/seo-category-pages"
import { categoryBrowsePath } from "@/lib/seo-category-pages-shared"
import { loadPublicAffiliateShopSlugs } from "@/lib/shop-storefront-data"
import { resolveSiteBaseUrl } from "@/lib/seo-site-url"

/** Google allows 50k URLs/sitemap — keep headroom for growth. */
export const SITEMAP_URLS_PER_CHUNK = 10_000

export const SITEMAP_CHUNK = {
  core: 0,
  shops: 1,
  listingsOffset: 2,
} as const

const SITEMAP_FALLBACK_CHUNK_IDS = [
  SITEMAP_CHUNK.core,
  SITEMAP_CHUNK.shops,
  SITEMAP_CHUNK.listingsOffset,
] as const

/** Build-time guard — CI/Lighthouse + Vercel static generation skip Prisma. */
export function isSitemapDatabaseAvailable(): boolean {
  return shouldQueryDatabaseDuringBuild()
}

export type SitemapBuildOptions = {
  baseUrl?: string
  shopLimit?: number
  categoryLimit?: number
  listingLimit?: number
  supplierLimit?: number
  /** Test/override hook — skip Prisma when building shop trust URLs. */
  shopSlugs?: string[]
}

export type ListingSitemapRow = {
  id: string
  customSlug: string | null
  storeSlug: string
}

const SHOP_TRUST_SUFFIXES = ["about", "faq", "returns"] as const

export async function loadPublicSupplierStoreSlugs(limit = 500): Promise<string[]> {
  const rows = await withPrismaReconnect(() =>
    prisma.store.findMany({
      where: { user: { role: "SUPPLIER" } },
      select: { slug: true },
      orderBy: { name: "asc" },
      take: limit,
    })
  )
  return rows.map((row) => row.slug)
}

export async function countPublicListingSitemapRows(): Promise<number> {
  return withPrismaReconnect(() =>
    prisma.affiliateProduct.count({
      where: {
        ...buyerListedAffiliateProductWhere,
        affiliate: { store: { isNot: null } },
      },
    })
  )
}

export async function loadPublicListingSitemapRows(
  args: { offset?: number; limit?: number } = {}
): Promise<ListingSitemapRow[]> {
  const offset = Math.max(0, args.offset ?? 0)
  const limit = Math.max(1, args.limit ?? 5000)

  const rows = await withPrismaReconnect(() =>
    prisma.affiliateProduct.findMany({
      where: {
        ...buyerListedAffiliateProductWhere,
        affiliate: { store: { isNot: null } },
      },
      select: {
        id: true,
        customSlug: true,
        affiliate: { select: { store: { select: { slug: true } } } },
      },
      orderBy: [{ conversions: "desc" }, { updatedAt: "desc" }],
      skip: offset,
      take: limit,
    })
  )

  return rows
    .map((row) => {
      const storeSlug = row.affiliate.store?.slug?.trim()
      if (!storeSlug) return null
      return {
        id: row.id,
        customSlug: row.customSlug,
        storeSlug,
      }
    })
    .filter((row): row is ListingSitemapRow => Boolean(row))
}

export function listingSitemapPath(row: ListingSitemapRow): string {
  return shopListingPath(row.storeSlug, row.id, row.customSlug)
}

export async function planAffisellSitemapChunks(
  listingChunkSize = SITEMAP_URLS_PER_CHUNK
): Promise<number[]> {
  if (!isSitemapDatabaseAvailable()) {
    console.warn("[seo-sitemap] skipping DB — minimal static sitemap chunks")
    return [...SITEMAP_FALLBACK_CHUNK_IDS]
  }

  try {
    const listingCount = await countPublicListingSitemapRows()
    const listingChunks = Math.max(1, Math.ceil(listingCount / listingChunkSize))
    return [
      SITEMAP_CHUNK.core,
      SITEMAP_CHUNK.shops,
      ...Array.from({ length: listingChunks }, (_, index) => SITEMAP_CHUNK.listingsOffset + index),
    ]
  } catch (err) {
    console.error("[seo-sitemap] plan chunks failed:", err)
    return [...SITEMAP_FALLBACK_CHUNK_IDS]
  }
}

function withBaseUrl(baseUrl: string, path: string, now: Date, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) {
  return {
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }
}

export async function buildAffisellSitemapChunk(
  chunkId: number,
  options: SitemapBuildOptions = {}
): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (options.baseUrl ?? resolveSiteBaseUrl()).replace(/\/$/, "")
  const now = new Date()

  if (chunkId === SITEMAP_CHUNK.core) {
    let categorySlugs: string[] = []
    let supplierSlugs: string[] = []
    if (isSitemapDatabaseAvailable()) {
      try {
        ;[categorySlugs, supplierSlugs] = await Promise.all([
          loadIndexableCategoryBrowseSlugs(options.categoryLimit ?? 500),
          loadPublicSupplierStoreSlugs(options.supplierLimit ?? 500),
        ])
      } catch (err) {
        console.error("[seo-sitemap] core chunk failed:", err)
      }
    }

    return [
      withBaseUrl(baseUrl, "/", now, 1, "weekly"),
      withBaseUrl(baseUrl, "/shops", now, 0.9, "daily"),
      withBaseUrl(baseUrl, "/sell", now, 0.85, "weekly"),
      withBaseUrl(baseUrl, "/how-it-works", now, 0.7, "monthly"),
      ...categorySlugs.map((slug) =>
        withBaseUrl(baseUrl, categoryBrowsePath(slug), now, 0.75, "daily")
      ),
      ...supplierSlugs.map((slug) =>
        withBaseUrl(baseUrl, `/store/supplier/${encodeURIComponent(slug)}`, now, 0.65, "weekly")
      ),
    ]
  }

  if (chunkId === SITEMAP_CHUNK.shops) {
    let shopSlugs: string[] = options.shopSlugs ?? []
    if (shopSlugs.length === 0 && isSitemapDatabaseAvailable()) {
      try {
        shopSlugs = await loadPublicAffiliateShopSlugs(options.shopLimit ?? 2000)
      } catch (err) {
        console.error("[seo-sitemap] shops chunk failed:", err)
      }
    }

    const entries: MetadataRoute.Sitemap = []
    for (const slug of shopSlugs) {
      const storefront = shopStorefrontPath(slug)
      entries.push(withBaseUrl(baseUrl, storefront, now, 0.8, "weekly"))
      for (const suffix of SHOP_TRUST_SUFFIXES) {
        entries.push(withBaseUrl(baseUrl, `${storefront}/${suffix}`, now, 0.55, "monthly"))
      }
    }
    return entries
  }

  const listingChunkIndex = chunkId - SITEMAP_CHUNK.listingsOffset
  if (listingChunkIndex < 0) return []

  const offset = listingChunkIndex * SITEMAP_URLS_PER_CHUNK
  const limit = options.listingLimit ?? SITEMAP_URLS_PER_CHUNK
  let rows: ListingSitemapRow[] = []
  if (isSitemapDatabaseAvailable()) {
    try {
      rows = await loadPublicListingSitemapRows({ offset, limit })
    } catch (err) {
      console.error("[seo-sitemap] listings chunk failed:", { chunkId, err })
    }
  }

  return rows.map((row) => withBaseUrl(baseUrl, listingSitemapPath(row), now, 0.6, "weekly"))
}

/** Monolithic sitemap — tests & legacy callers. */
export async function buildAffisellSitemap(
  options: SitemapBuildOptions = {}
): Promise<MetadataRoute.Sitemap> {
  const chunkIds = await planAffisellSitemapChunks()
  const parts = await Promise.all(chunkIds.map((id) => buildAffisellSitemapChunk(id, options)))
  return parts.flat()
}

import type { MetadataRoute } from "next"

import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma, withPrismaReconnect } from "@/lib/prisma"
import { loadIndexableCategoryBrowseSlugs } from "@/lib/seo-category-pages"
import { categoryBrowsePath } from "@/lib/seo-category-pages-shared"
import { loadPublicAffiliateShopSlugs } from "@/lib/shop-storefront-data"
import { resolveSiteBaseUrl } from "@/lib/seo-site-url"

export type SitemapBuildOptions = {
  baseUrl?: string
  shopLimit?: number
  categoryLimit?: number
  listingLimit?: number
  supplierLimit?: number
}

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

export async function loadPublicListingSitemapPaths(limit = 5000): Promise<string[]> {
  const rows = await withPrismaReconnect(() =>
    prisma.affiliateProduct.findMany({
      where: {
        ...buyerListedAffiliateProductWhere,
        affiliate: { store: { isNot: null } },
      },
      select: {
        id: true,
        affiliate: { select: { store: { select: { slug: true } } } },
      },
      orderBy: [{ conversions: "desc" }, { updatedAt: "desc" }],
      take: limit,
    })
  )

  return rows
    .map((row) => {
      const storeSlug = row.affiliate.store?.slug?.trim()
      if (!storeSlug) return null
      return `/shops/${encodeURIComponent(storeSlug)}/product/${encodeURIComponent(row.id)}`
    })
    .filter((path): path is string => Boolean(path))
}

export async function buildAffisellSitemap(
  options: SitemapBuildOptions = {}
): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (options.baseUrl ?? resolveSiteBaseUrl()).replace(/\/$/, "")
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/shops`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/sell`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ]

  let shopSlugs: string[] = []
  let categorySlugs: string[] = []
  let supplierSlugs: string[] = []
  let listingPaths: string[] = []

  try {
    ;[shopSlugs, categorySlugs, supplierSlugs, listingPaths] = await Promise.all([
      loadPublicAffiliateShopSlugs(options.shopLimit ?? 2000),
      loadIndexableCategoryBrowseSlugs(options.categoryLimit ?? 500),
      loadPublicSupplierStoreSlugs(options.supplierLimit ?? 500),
      loadPublicListingSitemapPaths(options.listingLimit ?? 5000),
    ])
  } catch (err) {
    console.error("[seo-sitemap] build failed:", err)
  }

  const shopUrls: MetadataRoute.Sitemap = shopSlugs.map((slug) => ({
    url: `${baseUrl}/shops/${encodeURIComponent(slug)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  const categoryUrls: MetadataRoute.Sitemap = categorySlugs.map((slug) => ({
    url: `${baseUrl}${categoryBrowsePath(slug)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.75,
  }))

  const supplierUrls: MetadataRoute.Sitemap = supplierSlugs.map((slug) => ({
    url: `${baseUrl}/store/supplier/${encodeURIComponent(slug)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.65,
  }))

  const listingUrls: MetadataRoute.Sitemap = listingPaths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }))

  return [...staticEntries, ...categoryUrls, ...shopUrls, ...supplierUrls, ...listingUrls]
}

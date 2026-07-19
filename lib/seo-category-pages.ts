import { cache } from "react"
import { unstable_cache } from "next/cache"

import { listingDisplayTitle } from "@/lib/affiliate-listing-display"
import { shopListingPath } from "@/lib/affiliate-routes"
import { computeBrowseCategoryScopeCounts } from "@/lib/browse-category-scope-counts"
import { shouldQueryDatabaseDuringBuild } from "@/lib/build-time-database"
import { computeMarketplaceCategoryTreeCounts } from "@/lib/marketplace-category-listing-counts"
import { fetchMarketplaceListings } from "@/lib/marketplace-listings-query"
import { prisma, withPrismaReconnect } from "@/lib/prisma"
import {
  categoryBrowsePath,
  type BrowseCategoryChildLink,
  type BrowseCategoryListingItem,
  type BrowseCategoryPageData,
} from "@/lib/seo-category-pages-shared"
import { resolveSiteBaseUrl } from "@/lib/seo-site-url"

export type {
  BrowseCategoryChildLink,
  BrowseCategoryListingItem,
  BrowseCategoryPageData,
} from "@/lib/seo-category-pages-shared"

export { categoryBrowsePath }

const BROWSE_DATA_REVALIDATE_SECONDS = 300

export type BrowseCategoryPageBundle = {
  category: BrowseCategoryPageData
  listings: BrowseCategoryListingItem[]
}

function normalizeBrowseSlug(slugRaw: string): string {
  return decodeURIComponent(slugRaw).trim().toLowerCase()
}

async function loadBrowseCategoryListingsUncached(
  categoryId: string,
  limit: number
): Promise<BrowseCategoryListingItem[]> {
  const params = new URLSearchParams({ category: categoryId })
  const rows = await fetchMarketplaceListings(params, limit, { lite: true })

  const items: BrowseCategoryListingItem[] = []
  for (const row of rows) {
    const storeSlug = typeof row.storeSlug === "string" ? row.storeSlug.trim() : ""
    if (!storeSlug) continue
    const listingId = typeof row.listingId === "string" ? row.listingId : String(row.id ?? "")
    if (!listingId) continue
    const name =
      typeof row.name === "string"
        ? row.name
        : listingDisplayTitle(null, typeof row.title === "string" ? row.title : "Produit")
    const priceCents =
      typeof row.sellingPriceCents === "number"
        ? row.sellingPriceCents
        : typeof row.price === "number"
          ? Math.round(row.price * 100)
          : 0
    const customSlug = typeof row.customSlug === "string" ? row.customSlug : null
    items.push({
      listingId,
      name,
      image: typeof row.image === "string" ? row.image : null,
      priceCents,
      href: shopListingPath(storeSlug, listingId, customSlug),
      storeName: typeof row.store === "string" ? row.store : null,
    })
  }
  return items
}

async function loadBrowseCategoryPageBundleUncached(
  slug: string
): Promise<BrowseCategoryPageBundle | null> {
  if (!slug) return null

  const row = await withPrismaReconnect(() =>
    prisma.category.findFirst({
      where: {
        OR: [
          { slug: { equals: slug, mode: "insensitive" } },
          { slug: { startsWith: `${slug}-`, mode: "insensitive" } },
        ],
      },
      orderBy: { slug: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        fullPath: true,
        metaTitle: true,
        metaDesc: true,
        parent: { select: { slug: true, name: true } },
        children: {
          select: { id: true, slug: true, name: true },
          orderBy: { name: "asc" },
          take: 48,
        },
      },
    })
  )
  if (!row) return null

  const [counts, listings] = await Promise.all([
    computeBrowseCategoryScopeCounts(
      row.id,
      row.children.map((child) => child.id)
    ),
    loadBrowseCategoryListingsUncached(row.id, 24),
  ])

  const children: BrowseCategoryChildLink[] = []
  for (const child of row.children) {
    const count = counts.byChildId[child.id] ?? 0
    if (count > 0) {
      children.push({ slug: child.slug, name: child.name, count })
    }
  }

  return {
    category: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      fullPath: row.fullPath,
      metaTitle: row.metaTitle,
      metaDesc: row.metaDesc,
      parent: row.parent,
      children,
      listingCount: counts.listingCount,
    },
    listings,
  }
}

/** Category meta + listings in one Data Cache entry (5 min). */
export const loadBrowseCategoryPageBundle = cache(async function loadBrowseCategoryPageBundle(
  slugRaw: string
): Promise<BrowseCategoryPageBundle | null> {
  const slug = normalizeBrowseSlug(slugRaw)
  if (!slug) return null

  return unstable_cache(
    () => loadBrowseCategoryPageBundleUncached(slug),
    ["browse-category-page-bundle", slug],
    { revalidate: BROWSE_DATA_REVALIDATE_SECONDS, tags: [`browse-category:${slug}`] }
  )()
})

/** Per-request dedupe + cross-request cache (5 min). */
export const loadBrowseCategoryBySlug = cache(async function loadBrowseCategoryBySlug(
  slugRaw: string
): Promise<BrowseCategoryPageData | null> {
  const bundle = await loadBrowseCategoryPageBundle(slugRaw)
  return bundle?.category ?? null
})

export const loadBrowseCategoryListings = cache(async function loadBrowseCategoryListings(
  categoryId: string,
  limit = 24
): Promise<BrowseCategoryListingItem[]> {
  const id = categoryId.trim()
  if (!id) return []

  return unstable_cache(
    () => loadBrowseCategoryListingsUncached(id, limit),
    ["browse-category-listings", id, String(limit)],
    { revalidate: BROWSE_DATA_REVALIDATE_SECONDS, tags: [`browse-listings:${id}`] }
  )()
})

export async function loadIndexableCategoryBrowseSlugs(limit = 500): Promise<string[]> {
  if (!shouldQueryDatabaseDuringBuild()) return []

  const roots = await withPrismaReconnect(() =>
    prisma.category.findMany({
      where: { parentId: null },
      select: {
        id: true,
        slug: true,
        children: { select: { id: true, slug: true }, orderBy: { name: "asc" } },
      },
      orderBy: { order: "asc" },
    })
  )

  if (roots.length === 0) return []

  const counts = await computeMarketplaceCategoryTreeCounts(
    roots.map((root) => ({
      id: root.id,
      children: root.children.map((child) => ({ id: child.id })),
    }))
  )

  const slugs: string[] = []
  for (const root of roots) {
    if ((counts.byRootId[root.id] ?? 0) > 0) slugs.push(root.slug)
    for (const child of root.children) {
      if ((counts.bySubId[child.id] ?? 0) > 0) slugs.push(child.slug)
    }
    if (slugs.length >= limit) break
  }

  return slugs.slice(0, limit)
}

export function buildCategoryBreadcrumbJsonLd(
  category: BrowseCategoryPageData,
  baseUrl = resolveSiteBaseUrl()
): Record<string, unknown> {
  const items: Array<{ name: string; item: string }> = [
    { name: "Affisell", item: `${baseUrl}/` },
    { name: category.name, item: `${baseUrl}${categoryBrowsePath(category.slug)}` },
  ]
  if (category.parent) {
    items.splice(1, 0, {
      name: category.parent.name,
      item: `${baseUrl}${categoryBrowsePath(category.parent.slug)}`,
    })
  }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.item,
    })),
  }
}

import { cache } from "react"

import { listingDisplayTitle } from "@/lib/affiliate-listing-display"
import { shopListingPath } from "@/lib/affiliate-routes"
import { shouldQueryDatabaseDuringBuild } from "@/lib/build-time-database"
import {
  computeMarketplaceCategoryTreeCounts,
  countMarketplaceListingsForScope,
} from "@/lib/marketplace-category-listing-counts"
import { fetchMarketplaceListings } from "@/lib/marketplace-listings-query"
import { prisma, withPrismaReconnect } from "@/lib/prisma"
import { resolveSiteBaseUrl } from "@/lib/seo-site-url"

export type BrowseCategoryChildLink = {
  slug: string
  name: string
  count: number
}

export type BrowseCategoryPageData = {
  id: string
  slug: string
  name: string
  fullPath: string
  metaTitle: string | null
  metaDesc: string | null
  parent: { slug: string; name: string } | null
  children: BrowseCategoryChildLink[]
  listingCount: number
}

export type BrowseCategoryListingItem = {
  listingId: string
  name: string
  image: string | null
  priceCents: number
  href: string
  storeName: string | null
}

import { categoryBrowsePath } from "@/lib/seo-category-pages-shared"

export { categoryBrowsePath }

export const loadBrowseCategoryBySlug = cache(async function loadBrowseCategoryBySlug(
  slugRaw: string
): Promise<BrowseCategoryPageData | null> {
  const slug = decodeURIComponent(slugRaw).trim().toLowerCase()
  if (!slug) return null

  const category = await withPrismaReconnect(() =>
    prisma.category.findFirst({
      where: {
        OR: [{ slug: { equals: slug, mode: "insensitive" } }, { slug: { startsWith: `${slug}-`, mode: "insensitive" } }],
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
        },
      },
    })
  )

  if (!category) return null

  const listingCount = await countMarketplaceListingsForScope({ categoryId: category.id })

  const children: BrowseCategoryChildLink[] = []
  for (const child of category.children) {
    const count = await countMarketplaceListingsForScope({ categoryId: child.id })
    if (count > 0) {
      children.push({ slug: child.slug, name: child.name, count })
    }
  }

  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    fullPath: category.fullPath,
    metaTitle: category.metaTitle,
    metaDesc: category.metaDesc,
    parent: category.parent,
    children,
    listingCount,
  }
})

export async function loadBrowseCategoryListings(
  categoryId: string,
  limit = 24
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

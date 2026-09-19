import "server-only"

import { unstable_cache } from "next/cache"

import {
  listingPrimaryImageUrl,
  pickListingCardImageUrl,
} from "@/lib/affiliate-listing-display"
import { shopListingPath } from "@/lib/affiliate-routes"
import { buildScopeIndexFromGraph } from "@/lib/marketplace-category-scope-index"
import { getCategorySubtreeGraph } from "@/lib/category-subtree-graph.server"
import {
  buildHomeCollections,
  type CollectionListing,
  type HomeCollection,
  type RootCategory,
} from "@/lib/home-collections"
import { listingDisplayTitle } from "@/lib/affiliate-listing-display"
import type { AppLocale } from "@/lib/i18n-locale"
import { resolveListingCardImageHref } from "@/lib/listing-card-image-shared"
import {
  countMarketplaceListingsForScopes,
  getMarketplaceListingCategoryRows,
} from "@/lib/marketplace-listing-category-index.server"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { loadMarketplaceCategoryTreeCached } from "@/lib/marketplace-category-tree"
import { prisma, withPrismaReconnect } from "@/lib/prisma"
import {
  BROWSE_DEPARTMENT_THEME,
  BROWSE_DEPARTMENT_THEME_ORDER,
  type BrowseDepartmentTheme,
} from "@/lib/taxonomy/browse-departments-shared"
import { loadBrowseDepartmentsCached } from "@/lib/taxonomy/resolve-browse-departments.server"

export type DirectoryEntry = {
  id: string
  label: string
  icon: string
  categoryId: string
  categorySlug: string
  count: number
}
export type DirectoryGroup = { theme: BrowseDepartmentTheme; entries: DirectoryEntry[] }

export type HomeDiscoveryPayload = {
  collections: HomeCollection[]
  directory: DirectoryGroup[]
}

const EMPTY: HomeDiscoveryPayload = { collections: [], directory: [] }
/** Ranked candidates read WITHOUT images (light) — same ranking as the marketplace default order. */
const CANDIDATE_TAKE = 240
const OVERPICK = 6

async function loadCollections(locale: AppLocale): Promise<HomeCollection[]> {
  const [tree, ranked] = await Promise.all([
    loadMarketplaceCategoryTreeCached(locale),
    withPrismaReconnect(() =>
      prisma.affiliateProduct.findMany({
        where: { ...buyerListedAffiliateProductWhere, affiliate: { store: { isNot: null } } },
        orderBy: [{ isFeatured: "desc" }, { conversions: "desc" }, { clicks: "desc" }, { updatedAt: "desc" }],
        take: CANDIDATE_TAKE,
        select: { id: true, sellingPriceCents: true, product: { select: { id: true, categoryId: true } } },
      })
    ),
  ])

  const roots: RootCategory[] = tree.categories.map((c) => ({
    id: c.id,
    name: c.name,
    subcategoryIds: c.subcategories.map((s) => s.id),
  }))

  // Pass 1 — pick candidate ids on light rows (placeholders stand in for image/title).
  const light: CollectionListing[] = ranked.map((r) => ({
    id: r.id,
    productId: r.product.id,
    title: "·",
    image: "·",
    href: "",
    priceCents: r.sellingPriceCents,
    categoryId: r.product.categoryId ?? null,
  }))
  const candidates = buildHomeCollections({ listings: light, roots, tileCount: OVERPICK, minTiles: 4 })
  const ids = [...new Set(candidates.flatMap((c) => c.tiles.map((t) => t.id)))]
  if (ids.length === 0) return []

  // Pass 2 — real titles / images / links for the few selected listings only.
  const rows = await withPrismaReconnect(() =>
    prisma.affiliateProduct.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sellingPriceCents: true,
        customImages: true,
        customTitle: true,
        customSlug: true,
        product: { select: { id: true, name: true, images: true, categoryId: true } },
        affiliate: { select: { store: { select: { slug: true } } } },
      },
    })
  )
  const byId = new Map(rows.map((r) => [r.id, r]))

  const detailed: CollectionListing[] = ranked.flatMap((r) => {
    const row = byId.get(r.id)
    if (!row) return []
    const image = resolveListingCardImageHref(
      pickListingCardImageUrl(row.customImages ?? [], row.product.images ?? []) ??
        (listingPrimaryImageUrl(row.customImages ?? [], row.product.images ?? []) || null),
      row.id
    )
    const slug = row.affiliate.store?.slug
    return [
      {
        id: row.id,
        productId: row.product.id,
        title: listingDisplayTitle(row.customTitle, row.product.name),
        image,
        href: slug ? shopListingPath(slug, row.id, row.customSlug) : `/marketplace/${encodeURIComponent(row.id)}`,
        priceCents: row.sellingPriceCents,
        categoryId: row.product.categoryId ?? null,
      },
    ]
  })

  return buildHomeCollections({ listings: detailed, roots })
}

async function loadDirectory(locale: AppLocale): Promise<DirectoryGroup[]> {
  const [{ departments }, graph, listings] = await Promise.all([
    loadBrowseDepartmentsCached(locale),
    getCategorySubtreeGraph(),
    getMarketplaceListingCategoryRows(),
  ])
  const resolved = departments.filter((d) => d.resolved && d.categoryId && d.categorySlug)
  const scopes = new Map(resolved.map((d) => [d.id, buildScopeIndexFromGraph(graph, d.categoryId!)]))
  const counts = countMarketplaceListingsForScopes(listings, scopes)

  const groups = new Map<BrowseDepartmentTheme, DirectoryEntry[]>()
  for (const d of resolved) {
    const theme = BROWSE_DEPARTMENT_THEME[d.id] ?? "other"
    const bucket = groups.get(theme) ?? []
    bucket.push({
      id: d.id,
      label: d.label,
      icon: d.icon,
      categoryId: d.categoryId!,
      categorySlug: d.categorySlug!,
      count: counts.get(d.id) ?? 0,
    })
    groups.set(theme, bucket)
  }
  return BROWSE_DEPARTMENT_THEME_ORDER.flatMap((theme) => {
    const entries = groups.get(theme)
    return entries?.length ? [{ theme, entries }] : []
  })
}

const loadCached = (locale: AppLocale) =>
  unstable_cache(
    async (): Promise<HomeDiscoveryPayload> => {
      const [collections, directory] = await Promise.all([loadCollections(locale), loadDirectory(locale)])
      return { collections, directory }
    },
    ["home-discovery-v1", locale],
    { revalidate: 120, tags: ["home", "marketplace-listing-counts"] }
  )()

/** Never throws and never delays the home more than `timeoutMs` — an empty payload simply hides the section. */
export async function loadHomeDiscoverySafe(locale: AppLocale, timeoutMs = 3000): Promise<HomeDiscoveryPayload> {
  try {
    return await Promise.race([
      loadCached(locale),
      new Promise<HomeDiscoveryPayload>((resolve) => setTimeout(() => resolve(EMPTY), timeoutMs)),
    ])
  } catch (error) {
    console.error("[home-discovery]", error instanceof Error ? error.message : String(error))
    return EMPTY
  }
}

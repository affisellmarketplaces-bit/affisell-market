import { cache } from "react"

import { localizeCategoryTree } from "@/lib/google-taxonomy-locale"
import type { AppLocale } from "@/lib/i18n-locale"
import { computeMarketplaceCategoryTreeCounts } from "@/lib/marketplace-category-listing-counts"
import { staticMarketplaceCategories } from "@/lib/marketplace-static-categories"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

export type MarketplaceCategoryTreeNode = {
  id: string
  name: string
  googleId?: number | string | null
  /** Full Google taxonomy breadcrumb (localized with tree). */
  fullPath: string
  icon: string
  slug: string
  order: number
  count: number
  subcategories: {
    id: string
    name: string
    googleId?: number | string | null
    fullPath: string
    slug: string
    count: number
  }[]
}

export type MarketplaceCategoryTreePayload = {
  categories: MarketplaceCategoryTreeNode[]
  catalogTotal: number
  locale: AppLocale
  staticFallback?: boolean
}

async function loadMarketplaceCategoryTreeUncached(
  locale: AppLocale
): Promise<MarketplaceCategoryTreePayload> {
  const categories = await withPrismaReconnect(() =>
    prisma.category.findMany({
      where: { parentId: null },
      select: {
        id: true,
        name: true,
        googleId: true,
        fullPath: true,
        icon: true,
        slug: true,
        order: true,
        children: {
          select: {
            id: true,
            name: true,
            googleId: true,
            fullPath: true,
            slug: true,
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { order: "asc" },
    })
  )

  const treeInput = categories.map((cat) => ({
    id: cat.id,
    children: cat.children.map((sub) => ({ id: sub.id })),
  }))
  const { catalogTotal, byRootId, bySubId } = await computeMarketplaceCategoryTreeCounts(treeInput)

  const categoriesWithCounts = categories
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      googleId: cat.googleId,
      fullPath: cat.fullPath,
      icon: cat.icon,
      slug: cat.slug,
      order: cat.order,
      count: byRootId[cat.id] ?? 0,
      subcategories: cat.children.map((sub) => ({
        id: sub.id,
        name: sub.name,
        googleId: sub.googleId,
        fullPath: sub.fullPath,
        slug: sub.slug,
        count: bySubId[sub.id] ?? 0,
      })),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.order - b.order
    })

  return {
    categories: localizeCategoryTree(categoriesWithCounts, locale),
    catalogTotal,
    locale,
  }
}

export async function loadMarketplaceCategoryTree(
  locale: AppLocale
): Promise<MarketplaceCategoryTreePayload> {
  try {
    return await loadMarketplaceCategoryTreeUncached(locale)
  } catch (error) {
    console.error("[marketplace-category-tree]", error)
    const staticCats = staticMarketplaceCategories(locale)
    return {
      categories: localizeCategoryTree(staticCats, locale),
      catalogTotal: 0,
      locale,
      staticFallback: true,
    }
  }
}

const CATEGORY_TREE_REVALIDATE_SEC = 120

/**
 * Shared by home SSR and `/api/categories` — per-request dedupe via React `cache`.
 * (Full taxonomy tree exceeds Next.js `unstable_cache` 2MB limit.)
 */
export const loadMarketplaceCategoryTreeCached = cache((locale: AppLocale) =>
  loadMarketplaceCategoryTree(locale)
)

export { CATEGORY_TREE_REVALIDATE_SEC }

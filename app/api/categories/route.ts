import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { localizeCategoryTree } from "@/lib/google-taxonomy-locale"
import { LOCALE_COOKIE, resolveAppLocale } from "@/lib/i18n-locale"
import { computeMarketplaceCategoryTreeCounts } from "@/lib/marketplace-category-listing-counts"
import { staticMarketplaceCategories } from "@/lib/marketplace-static-categories"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Category tree for marketplace sidebar + department rail.
 * `count` = live listed SKUs in that department (subtree) or sub-aisle.
 */
export async function GET() {
  const cookieStore = await cookies()
  const locale = resolveAppLocale(cookieStore.get(LOCALE_COOKIE)?.value)

  try {
    const categories = await withPrismaReconnect(() =>
      prisma.category.findMany({
        where: { parentId: null },
        select: {
          id: true,
          name: true,
          googleId: true,
          icon: true,
          slug: true,
          order: true,
          children: {
            select: {
              id: true,
              name: true,
              googleId: true,
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

    const categoriesWithCounts = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      googleId: cat.googleId,
      icon: cat.icon,
      slug: cat.slug,
      order: cat.order,
      count: byRootId[cat.id] ?? 0,
      subcategories: cat.children.map((sub) => ({
        id: sub.id,
        name: sub.name,
        googleId: sub.googleId,
        slug: sub.slug,
        count: bySubId[sub.id] ?? 0,
      })),
    }))

    return NextResponse.json(
      {
        categories: localizeCategoryTree(categoriesWithCounts, locale),
        locale,
        catalogTotal,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
        },
      }
    )
  } catch (e) {
    console.error("[api/categories]", e)
    const staticCats = staticMarketplaceCategories()
    return NextResponse.json({
      categories: localizeCategoryTree(staticCats, locale),
      locale,
      catalogTotal: 0,
      staticFallback: true,
      ...dbUnavailablePayload(e),
    })
  }
}

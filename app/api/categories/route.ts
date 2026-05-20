import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { localizeCategoryTree } from "@/lib/google-taxonomy-locale"
import { LOCALE_COOKIE, resolveAppLocale } from "@/lib/i18n-locale"
import { staticMarketplaceCategories } from "@/lib/marketplace-static-categories"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Category tree for marketplace sidebar.
 * Product counts are omitted here (they required N+1 queries and burned DB egress).
 * Listing counts per category are reflected when users open a category filter.
 */
export async function GET() {
  const cookieStore = await cookies()
  const locale = resolveAppLocale(cookieStore.get(LOCALE_COOKIE)?.value)

  try {
    const categories = await prisma.category.findMany({
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

    const categoriesWithCounts = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      googleId: cat.googleId,
      icon: cat.icon,
      slug: cat.slug,
      order: cat.order,
      count: 0,
      subcategories: cat.children.map((sub) => ({
        id: sub.id,
        name: sub.name,
        googleId: sub.googleId,
        slug: sub.slug,
        count: 0,
      })),
    }))

    return NextResponse.json({
      categories: localizeCategoryTree(categoriesWithCounts, locale),
      locale,
    })
  } catch (e) {
    console.error("[api/categories]", e)
    const staticCats = staticMarketplaceCategories()
    return NextResponse.json({
      categories: localizeCategoryTree(staticCats, locale),
      locale,
      staticFallback: true,
      ...dbUnavailablePayload(e),
    })
  }
}

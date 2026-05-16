import { NextResponse } from "next/server"

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
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      select: {
        id: true,
        name: true,
        icon: true,
        slug: true,
        order: true,
        children: {
          select: {
            id: true,
            name: true,
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
      icon: cat.icon,
      slug: cat.slug,
      order: cat.order,
      count: 0,
      subcategories: cat.children.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        count: 0,
      })),
    }))

    return NextResponse.json({ categories: categoriesWithCounts })
  } catch (e) {
    console.error("[api/categories]", e)
    return NextResponse.json({
      categories: staticMarketplaceCategories(),
      staticFallback: true,
      ...dbUnavailablePayload(e),
    })
  }
}

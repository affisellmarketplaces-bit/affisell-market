import { NextResponse } from "next/server"

import { countListedProductsInCategoryScope } from "@/lib/marketplace-category-counts"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

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
        subcategories: {
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

    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const subcategories = await Promise.all(
          cat.subcategories.map(async (sub) => ({
            id: sub.id,
            name: sub.name,
            slug: sub.slug,
            count: await countListedProductsInCategoryScope(prisma, sub.id),
          }))
        )
        const count = await countListedProductsInCategoryScope(prisma, cat.id)
        return {
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          slug: cat.slug,
          order: cat.order,
          count,
          subcategories,
        }
      })
    )

    return NextResponse.json({ categories: categoriesWithCounts })
  } catch (e) {
    console.error("[api/categories]", e)
    return NextResponse.json({ categories: [] }, { status: 500 })
  }
}

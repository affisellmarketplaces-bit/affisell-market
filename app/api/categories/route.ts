import { NextResponse } from "next/server"

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
        _count: { select: { products: true } },
        subcategories: {
          select: {
            id: true,
            name: true,
            slug: true,
            _count: { select: { products: true } },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { order: "asc" },
    })

    const categoriesWithCounts = categories.map((cat) => {
      const subcategories = cat.subcategories.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        count: sub._count.products,
      }))
      const nestedSum = subcategories.reduce((sum, sub) => sum + sub.count, 0)
      const direct = cat._count.products
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        slug: cat.slug,
        order: cat.order,
        count: direct + nestedSum,
        subcategories,
      }
    })

    return NextResponse.json({ categories: categoriesWithCounts })
  } catch (e) {
    console.error("[api/categories]", e)
    return NextResponse.json({ categories: [] }, { status: 500 })
  }
}

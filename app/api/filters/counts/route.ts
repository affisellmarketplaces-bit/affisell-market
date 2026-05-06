import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Active catalogue only — matches marketplace listing semantics. */
const activeProductWhere = { active: true }

function capitalizeStyle(slug: string | null): string {
  if (!slug) return ""
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ")
}

async function countCategoryProducts(categoryId: string, categoryName: string): Promise<number> {
  return prisma.product.count({
    where: {
      ...activeProductWhere,
      OR: [{ categoryId }, { categories: { has: categoryName } }],
    },
  })
}

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const categoryRows = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, icon: true },
    })

    const categoriesWithCount = await Promise.all(
      categoryRows.map(async (c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon ?? "📦",
        count: await countCategoryProducts(c.id, c.name),
      }))
    )

    const styleAgg = await prisma.product.groupBy({
      by: ["style"],
      where: { ...activeProductWhere, style: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    })

    const styles = styleAgg
      .filter((s) => s.style != null && s.style !== "")
      .map((s) => ({
        id: String(s.style),
        name: capitalizeStyle(String(s.style)),
        count: s._count.id,
      }))

    const priceRangesCounts = await Promise.all([
      prisma.product.count({
        where: { ...activeProductWhere, basePriceCents: { lt: Math.round(25 * 100) } },
      }),
      prisma.product.count({
        where: {
          ...activeProductWhere,
          basePriceCents: { gte: Math.round(25 * 100), lt: Math.round(50 * 100) },
        },
      }),
      prisma.product.count({
        where: {
          ...activeProductWhere,
          basePriceCents: { gte: Math.round(50 * 100), lt: Math.round(100 * 100) },
        },
      }),
      prisma.product.count({
        where: {
          ...activeProductWhere,
          basePriceCents: { gte: Math.round(100 * 100), lt: Math.round(200 * 100) },
        },
      }),
      prisma.product.count({
        where: {
          ...activeProductWhere,
          basePriceCents: { gte: Math.round(200 * 100), lt: Math.round(500 * 100) },
        },
      }),
      prisma.product.count({
        where: {
          ...activeProductWhere,
          basePriceCents: { gte: Math.round(500 * 100), lt: Math.round(1000 * 100) },
        },
      }),
      prisma.product.count({
        where: { ...activeProductWhere, basePriceCents: { gte: Math.round(1000 * 100) } },
      }),
    ])

    const priceRanges = [
      { id: "under-25", name: "Under $25", count: priceRangesCounts[0] },
      { id: "25-50", name: "$25 to $50", count: priceRangesCounts[1] },
      { id: "50-100", name: "$50 to $100", count: priceRangesCounts[2] },
      { id: "100-200", name: "$100 to $200", count: priceRangesCounts[3] },
      { id: "200-500", name: "$200 to $500", count: priceRangesCounts[4] },
      { id: "500-1000", name: "$500 to $1,000", count: priceRangesCounts[5] },
      { id: "over-1000", name: "$1,000 & Above", count: priceRangesCounts[6] },
    ]

    const deliveryAgg = await prisma.product.groupBy({
      by: ["shippingType"],
      where: activeProductWhere,
      _count: { id: true },
      orderBy: { shippingType: "asc" },
    })

    const delivery = deliveryAgg.map((d) => ({
      type: d.shippingType,
      count: d._count.id,
    }))

    const [onSale, newArrivals, bestSellers, refurbished, hasCoupon] = await Promise.all([
      prisma.product.count({ where: { ...activeProductWhere, isOnSale: true } }),
      prisma.product.count({
        where: { ...activeProductWhere, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.product.count({ where: { ...activeProductWhere, isBestSeller: true } }),
      prisma.product.count({ where: { ...activeProductWhere, isRefurbished: true } }),
      prisma.product.count({ where: { ...activeProductWhere, hasCoupon: true } }),
    ])

    const offers = {
      onSale,
      newArrivals,
      bestSellers,
      refurbished,
      hasCoupon,
    }

    return NextResponse.json({
      categories: categoriesWithCount,
      styles,
      priceRanges,
      delivery,
      offers,
    })
  } catch (e) {
    console.error("[filters/counts]", e)
    return NextResponse.json({ error: "Failed to load filter counts" }, { status: 500 })
  }
}

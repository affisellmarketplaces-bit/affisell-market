import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** In-stock, active SKUs only (marketplace listable inventory). */
const listable = {
  active: true,
  stock: { gt: 0 },
} as const

function deliveryLabel(type: string): string {
  switch (type) {
    case "free":
      return "Free Shipping"
    case "prime":
      return "Affisell Prime"
    case "same-day":
      return "Same Day"
    case "next-day":
      return "Next Day"
    case "international":
      return "International"
    default:
      return "Standard"
  }
}

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [categories, styleRows, priceCounts, deliveryRows, offerRows] = await Promise.all([
      prisma.category.findMany({
        select: {
          id: true,
          name: true,
          icon: true,
          order: true,
          _count: {
            select: {
              products: { where: listable },
            },
          },
        },
        orderBy: { order: "asc" },
      }),

      prisma.product.groupBy({
        by: ["style"],
        where: {
          ...listable,
          style: { not: null },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),

      Promise.all([
        prisma.product.count({
          where: { ...listable, basePriceCents: { lt: Math.round(25 * 100) } },
        }),
        prisma.product.count({
          where: {
            ...listable,
            basePriceCents: { gte: Math.round(25 * 100), lt: Math.round(50 * 100) },
          },
        }),
        prisma.product.count({
          where: {
            ...listable,
            basePriceCents: { gte: Math.round(50 * 100), lt: Math.round(100 * 100) },
          },
        }),
        prisma.product.count({
          where: {
            ...listable,
            basePriceCents: { gte: Math.round(100 * 100), lt: Math.round(200 * 100) },
          },
        }),
        prisma.product.count({
          where: {
            ...listable,
            basePriceCents: { gte: Math.round(200 * 100), lt: Math.round(500 * 100) },
          },
        }),
        prisma.product.count({
          where: {
            ...listable,
            basePriceCents: { gte: Math.round(500 * 100), lt: Math.round(1000 * 100) },
          },
        }),
        prisma.product.count({
          where: { ...listable, basePriceCents: { gte: Math.round(1000 * 100) } },
        }),
      ]),

      prisma.product.groupBy({
        by: ["shippingType"],
        where: listable,
        _count: { id: true },
        orderBy: { shippingType: "asc" },
      }),

      Promise.all([
        prisma.product.count({ where: { ...listable, isOnSale: true } }),
        prisma.product.count({
          where: { ...listable, createdAt: { gte: thirtyDaysAgo } },
        }),
        prisma.product.count({ where: { ...listable, isBestSeller: true } }),
        prisma.product.count({ where: { ...listable, isRefurbished: true } }),
        prisma.product.count({ where: { ...listable, hasCoupon: true } }),
        prisma.product.count({ where: { ...listable, isEcoFriendly: true } }),
      ]),
    ])

    const priceRanges = [
      { name: "Under $25", min: 0, max: 25, count: priceCounts[0] },
      { name: "$25 to $50", min: 25, max: 50, count: priceCounts[1] },
      { name: "$50 to $100", min: 50, max: 100, count: priceCounts[2] },
      { name: "$100 to $200", min: 100, max: 200, count: priceCounts[3] },
      { name: "$200 to $500", min: 200, max: 500, count: priceCounts[4] },
      { name: "$500 to $1,000", min: 500, max: 1000, count: priceCounts[5] },
      { name: "$1,000 & Above", min: 1000, max: null, count: priceCounts[6] },
    ].filter((r) => r.count > 0)

    return NextResponse.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        count: c._count.products,
      })),
      styles: styleRows
        .filter((s) => s.style != null && String(s.style).length > 0)
        .map((s) => ({
          name: s.style,
          count: s._count.id,
        })),
      priceRanges,
      delivery: deliveryRows.map((d) => ({
        type: d.shippingType,
        count: d._count.id,
        label: deliveryLabel(d.shippingType),
      })),
      offers: {
        onSale: offerRows[0],
        newArrivals: offerRows[1],
        bestSellers: offerRows[2],
        refurbished: offerRows[3],
        hasCoupon: offerRows[4],
        ecoFriendly: offerRows[5],
      },
    })
  } catch (e) {
    console.error("[api/filters]", e)
    return NextResponse.json({ error: "Failed to load filters" }, { status: 500 })
  }
}

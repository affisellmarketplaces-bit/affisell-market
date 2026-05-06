import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

/** USD price buckets use `basePriceCents` (schema has no `price` field). */
const USD = (d: number) => Math.round(d * 100)

function deliveryLabel(shippingType: string): string {
  if (shippingType === "free") return "Free Shipping"
  if (shippingType === "prime") return "Affisell Prime"
  if (shippingType === "same-day") return "Same Day"
  if (shippingType === "next-day") return "Next Day"
  if (shippingType === "international") return "International"
  return "Standard"
}

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [categories, styles, priceRanges, delivery, offers] = await Promise.all([
      prisma.category.findMany({
        select: {
          id: true,
          name: true,
          icon: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: { order: "asc" },
      }),

      prisma.product.groupBy({
        by: ["style"],
        where: {
          style: { not: null },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),

      Promise.all([
        prisma.product.count({ where: { basePriceCents: { lt: USD(25) } } }),
        prisma.product.count({
          where: { basePriceCents: { gte: USD(25), lt: USD(50) } },
        }),
        prisma.product.count({
          where: { basePriceCents: { gte: USD(50), lt: USD(100) } },
        }),
        prisma.product.count({
          where: { basePriceCents: { gte: USD(100), lt: USD(200) } },
        }),
        prisma.product.count({
          where: { basePriceCents: { gte: USD(200), lt: USD(500) } },
        }),
        prisma.product.count({
          where: { basePriceCents: { gte: USD(500), lt: USD(1000) } },
        }),
        prisma.product.count({ where: { basePriceCents: { gte: USD(1000) } } }),
      ]),

      prisma.product.groupBy({
        by: ["shippingType"],
        _count: { id: true },
        orderBy: { shippingType: "asc" },
      }),

      Promise.all([
        prisma.product.count({ where: { isOnSale: true } }),
        prisma.product.count({
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),
        prisma.product.count({ where: { isBestSeller: true } }),
        prisma.product.count({ where: { isRefurbished: true } }),
        prisma.product.count({ where: { hasCoupon: true } }),
        prisma.product.count({ where: { isEcoFriendly: true } }),
      ]),
    ])

    return NextResponse.json({
      categories:
        categories?.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon || "📦",
          count: c._count?.products ?? 0,
        })) ?? [],

      styles:
        styles
          ?.map((s) => ({
            name: s.style,
            count: s._count?.id ?? 0,
          }))
          .filter((s) => s.name != null && String(s.name).length > 0) ?? [],

      priceRanges: [
        { name: "Under $25", min: 0, max: 25, count: priceRanges[0] ?? 0 },
        { name: "$25 to $50", min: 25, max: 50, count: priceRanges[1] ?? 0 },
        { name: "$50 to $100", min: 50, max: 100, count: priceRanges[2] ?? 0 },
        { name: "$100 to $200", min: 100, max: 200, count: priceRanges[3] ?? 0 },
        { name: "$200 to $500", min: 200, max: 500, count: priceRanges[4] ?? 0 },
        { name: "$500 to $1,000", min: 500, max: 1000, count: priceRanges[5] ?? 0 },
        { name: "$1,000 & Above", min: 1000, max: null, count: priceRanges[6] ?? 0 },
      ].filter((r) => r.count > 0),

      delivery:
        delivery?.map((d) => ({
          type: d.shippingType,
          count: d._count?.id ?? 0,
          label: deliveryLabel(d.shippingType),
        })) ?? [],

      offers: {
        onSale: offers[0] ?? 0,
        newArrivals: offers[1] ?? 0,
        bestSellers: offers[2] ?? 0,
        refurbished: offers[3] ?? 0,
        hasCoupon: offers[4] ?? 0,
        ecoFriendly: offers[5] ?? 0,
      },
    })
  } catch (error) {
    console.error("Filter API error:", error)
    return NextResponse.json({
      categories: [],
      styles: [],
      priceRanges: [],
      delivery: [],
      offers: {
        onSale: 0,
        newArrivals: 0,
        bestSellers: 0,
        refurbished: 0,
        hasCoupon: 0,
        ecoFriendly: 0,
      },
    })
  }
}

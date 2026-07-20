import { shopListingPath } from "@/lib/affiliate-routes"
import {
  buyerListedAffiliateProductWhere,
  buyerMarketplaceProductWhere,
} from "@/lib/marketplace-buyer-product-filter"
import { prisma, withPrismaReconnect } from "@/lib/prisma"

export type AffisellFrRadarRow = {
  id: string
  title: string
  marketplaceId: string
  country: string
  price: number
  currency: string
  rank: number | null
  salesEst: number | null
  imageUrl: string | null
  url: string | null
  crawledAt: Date
}

const frProductWhere = {
  ...buyerMarketplaceProductWhere,
  OR: [
    { shippingCountry: "FR" },
    { deliveryCountryCodes: { has: "FR" } },
    { shipsFrom: { equals: "FR", mode: "insensitive" as const } },
    { warehouseCity: { contains: "France", mode: "insensitive" as const } },
  ],
}

/** Listed Affisell SKUs with Stock FR — Radar dashboard (not Amazon scrape). */
export async function loadAffisellFrRadarWinners(args: {
  limit?: number
  q?: string
}): Promise<AffisellFrRadarRow[]> {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
  const q = args.q?.trim()

  const rows = await withPrismaReconnect(() =>
    prisma.affiliateProduct.findMany({
      where: {
        ...buyerListedAffiliateProductWhere,
        affiliate: { store: { isNot: null } },
        product: frProductWhere,
        ...(q
          ? {
              OR: [
                { customTitle: { contains: q, mode: "insensitive" } },
                { product: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        sellingPriceCents: true,
        customTitle: true,
        conversions: true,
        affiliate: { select: { store: { select: { slug: true } } } },
        product: {
          select: {
            name: true,
            images: true,
            basePriceCents: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [{ conversions: "desc" }, { clicks: "desc" }, { updatedAt: "desc" }],
      take: limit,
    })
  )

  return rows.map((row, index) => {
    const storeSlug = row.affiliate.store?.slug?.trim() ?? ""
    const priceCents =
      row.sellingPriceCents > 0
        ? row.sellingPriceCents
        : row.product.basePriceCents > 0
          ? row.product.basePriceCents
          : 0
    const image = row.product.images?.[0]?.trim() || null
    return {
      id: row.id,
      title: row.customTitle?.trim() || row.product.name,
      marketplaceId: "affisell_fr",
      country: "FR",
      price: priceCents / 100,
      currency: "EUR",
      rank: index + 1,
      salesEst: row.conversions > 0 ? row.conversions : null,
      imageUrl: image,
      url: storeSlug ? shopListingPath(storeSlug, row.id) : null,
      crawledAt: row.product.updatedAt,
    }
  })
}

export async function countSupplierFrRadarProducts(supplierId: string): Promise<number> {
  return withPrismaReconnect(() =>
    prisma.product.count({
      where: {
        supplierId,
        active: true,
        isDraft: false,
        OR: [
          { shippingCountry: "FR" },
          { deliveryCountryCodes: { has: "FR" } },
        ],
      },
    })
  )
}

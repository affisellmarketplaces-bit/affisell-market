import type { Prisma } from "@prisma/client"
import { PrismaClient } from "@prisma/client"

import type { CarouselItemJson } from "@/lib/carousel-types"
import { primaryProductImage } from "@/lib/product-images"

type ListingRow = Prisma.AffiliateProductGetPayload<{
  select: {
    id: true
    sellingPriceCents: true
    customTitle: true
    customImages: true
    product: {
      select: {
        id: true
        name: true
        basePriceCents: true
        images: true
        stock: true
        deliveryMin: true
        deliveryMax: true
        freeShipping: true
      }
    }
  }
}>

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))
}

export async function viewCountsToday(
  db: PrismaClient,
  productIds: string[]
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map()
  const start = startOfUtcDay(new Date())
  const rows = await db.affisellTrackEvent.groupBy({
    by: ["productId"],
    where: {
      eventType: "view",
      productId: { in: productIds },
      createdAt: { gte: start },
    },
    _count: { id: true },
  })
  return new Map(rows.map((r) => [r.productId!, r._count.id]))
}

export function mapListingToCarousel(
  row: ListingRow,
  ctx: {
    viewsToday: number
    sold30d: number
    contextQuery: string | null
    aiPick: boolean
  }
): CarouselItemJson {
  const p = row.product
  const name = row.customTitle?.trim() || p.name
  const imageUrl =
    primaryProductImage(row.customImages as string[] | undefined) || primaryProductImage(p.images) || null
  const priceCents = row.sellingPriceCents
  const compareAt = p.basePriceCents > priceCents ? p.basePriceCents : null
  const promoPercent =
    compareAt != null ? Math.round(((compareAt - priceCents) / compareAt) * 100) : null

  return {
    listingId: row.id,
    productId: p.id,
    name,
    imageUrl,
    priceCents,
    compareAtCents: compareAt != null && compareAt > priceCents ? compareAt : null,
    stock: p.stock,
    deliveryMin: p.deliveryMin,
    deliveryMax: p.deliveryMax,
    freeShipping: p.freeShipping,
    viewsToday: ctx.viewsToday,
    sold30d: ctx.sold30d,
    isTrending: ctx.viewsToday >= 5,
    promoPercent,
    contextQuery: ctx.contextQuery,
    aiPick: ctx.aiPick,
  }
}

import "server-only"

import type { Prisma } from "@prisma/client"

import { buildAffiliateCatalogProductWhere } from "@/lib/affiliate-catalog-query"
import type { SwipeFeedFilters, SwipeFeedProduct } from "@/lib/affiliate-swipe-feed-types"
import { primaryProductImage } from "@/lib/product-images"
import { prisma } from "@/lib/prisma"

function estimateMarginCents(basePriceCents: number, commissionRate: number): number {
  const pct = Number(commissionRate) || 0
  return Math.max(0, Math.round((basePriceCents * pct) / 100))
}

function supplierLabel(row: {
  supplier: { email: string; store: { name: string } | null }
}): string {
  const brand = row.supplier.store?.name?.trim()
  if (brand) return brand
  return row.supplier.email
}

function filtersToSearchParams(filters: SwipeFeedFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.categoryId) params.set("categoryId", filters.categoryId)
  if (filters.niche) params.set("niche", filters.niche)
  if (filters.q) params.set("q", filters.q)
  return params
}

export function sellingPriceFromMarkup(basePriceCents: number, markupRate: number): number {
  const rate = Number.isFinite(markupRate) && markupRate >= 0 ? markupRate : 0.3
  return Math.max(basePriceCents, Math.round(basePriceCents * (1 + rate)))
}

export async function buildSwipeFeedWhere(
  affiliateId: string,
  filters: SwipeFeedFilters,
  options?: { excludeSkipped?: boolean }
): Promise<Prisma.ProductWhereInput> {
  const catalogWhere = await buildAffiliateCatalogProductWhere(filtersToSearchParams(filters))
  const minCommission =
    typeof filters.minCommission === "number" && filters.minCommission > 0
      ? filters.minCommission
      : null

  const andParts: Prisma.ProductWhereInput[] = [
    catalogWhere,
    {
      affiliateProducts: { none: { affiliateId, isListed: true } },
    },
  ]

  if (options?.excludeSkipped !== false) {
    andParts.push({
      affiliateSwipes: {
        none: { affiliateId, action: "skip" },
      },
    })
  }

  if (minCommission != null) {
    andParts.push({ commissionRate: { gte: minCommission } })
  }

  return { AND: andParts }
}

function mapSwipeFeedRows(
  rows: Array<{
    id: string
    name: string
    images: unknown
    categories: string[]
    basePriceCents: number
    commissionRate: unknown
    deliveryMax: number | null
    supplier: { email: string; isVerifiedSupplier: boolean; store: { name: string } | null }
  }>
): SwipeFeedProduct[] {
  return rows.map((p) => {
    const commissionRate = Math.round(Number(p.commissionRate) || 0)
    return {
      id: p.id,
      name: p.name,
      imageUrl: primaryProductImage(p.images as string[]) || null,
      images: (p.images as string[]).filter(Boolean),
      categories: p.categories,
      basePriceCents: p.basePriceCents,
      commissionRate,
      marginCents: estimateMarginCents(p.basePriceCents, commissionRate),
      supplierLabel: supplierLabel(p),
      isVerifiedSupplier: p.supplier.isVerifiedSupplier,
      deliveryMax: p.deliveryMax,
    }
  })
}

const productSelect = {
  id: true,
  name: true,
  images: true,
  categories: true,
  basePriceCents: true,
  commissionRate: true,
  deliveryMax: true,
  supplier: {
    select: {
      email: true,
      isVerifiedSupplier: true,
      store: { select: { name: true } },
    },
  },
} as const

function isAffiliateSwipeSchemaError(e: unknown): boolean {
  if (typeof e !== "object" || !e) return false
  const msg = String((e as { message?: string }).message ?? "")
  return (
    msg.includes("AffiliateSwipe") ||
    msg.includes("affiliateSwipes") ||
    (e as { code?: string }).code === "P2021"
  )
}

export async function loadSwipeFeedProducts(
  affiliateId: string,
  filters: SwipeFeedFilters,
  take = 12
): Promise<SwipeFeedProduct[]> {
  const limit = Math.min(48, Math.max(3, take))
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { commissionRate: "desc" },
    { createdAt: "desc" },
  ]

  try {
    const where = await buildSwipeFeedWhere(affiliateId, filters, { excludeSkipped: true })
    const rows = await prisma.product.findMany({
      where,
      orderBy,
      take: limit,
      select: productSelect,
    })
    return mapSwipeFeedRows(rows)
  } catch (e) {
    if (!isAffiliateSwipeSchemaError(e)) throw e
    console.warn("[swipe-feed] AffiliateSwipe unavailable — loading without skip filter")
    const where = await buildSwipeFeedWhere(affiliateId, filters, { excludeSkipped: false })
    const rows = await prisma.product.findMany({
      where,
      orderBy,
      take: limit,
      select: productSelect,
    })
    return mapSwipeFeedRows(rows)
  }
}

export async function recordAffiliateSwipe(
  affiliateId: string,
  productId: string,
  action: "like" | "skip"
) {
  return prisma.affiliateSwipe.upsert({
    where: { affiliateId_productId: { affiliateId, productId } },
    create: { affiliateId, productId, action },
    update: { action },
  })
}

export async function undoAffiliateSwipe(affiliateId: string, productId: string) {
  return prisma.affiliateSwipe.deleteMany({
    where: { affiliateId, productId },
  })
}

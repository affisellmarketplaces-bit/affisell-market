import { affiliateRoleMarketplaceWhere } from "@/lib/marketplace-affiliate-listing-filter"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"
import { publicPartnerSellerLabel } from "@/lib/public-seller-display"

const MS_DAY = 24 * 60 * 60 * 1000

export type HomeProductCard = {
  listingId: string
  productId: string
  name: string
  imageUrl: string | null
  priceCents: number
  compareAtCents: number | null
  soldCount: number
  marginCents: number
  deliveryMin: number
  deliveryMax: number
  stock: number
  freeShipping: boolean
  storeName: string
  isBestSeller?: boolean
}

export type HomeMarketplaceStats = {
  productCount: number
  avgCommissionPct: number
  productCountLabel: string
  avgCommissionLabel: string
}

export type HomeHighlightsData = {
  bestSellers7d: HomeProductCard[]
  newArrivals: HomeProductCard[]
  highMargin: HomeProductCard[]
}

export type HomeBarometerCategory = {
  category: string
  categorySlug: string
  totalCents: number
  pctOfTop: number
  growthPct: number | null
  isNew: boolean
  totalLabel: string
}

export type HomeBarometerData = {
  categories: HomeBarometerCategory[]
  chartData: { name: string; sales: number }[]
}

function estimateMarginCents(sellingPriceCents: number, basePriceCents: number): number {
  return Math.max(0, sellingPriceCents - basePriceCents)
}

function deliveryRangeLabel(min: number, max: number): string {
  const lo = Math.max(1, min || 2)
  const hi = Math.max(lo, max || 7)
  return `${lo}-${hi}j`
}

type ListingRow = {
  id: string
  sellingPriceCents: number
  productId: string
  product: {
    id: string
    name: string
    images: string[]
    basePriceCents: number
    commissionRate: number
    deliveryMin: number
    deliveryMax: number
    deliveryDays: number | null
    isBestSeller: boolean
    stock: number
    freeShipping: boolean
  }
  affiliate: { name: string | null; store: { name: string } | null }
}

function mapListingToHomeCard(
  row: ListingRow,
  soldCount: number,
  storeName: string
): HomeProductCard {
  const p = row.product
  const deliveryMin = p.deliveryMin ?? 2
  const deliveryMax = p.deliveryMax ?? p.deliveryDays ?? 7
  const stock = p.stock
  return {
    listingId: row.id,
    productId: p.id,
    name: p.name,
    imageUrl: primaryProductImage(p.images) || null,
    priceCents: row.sellingPriceCents,
    compareAtCents: p.basePriceCents > row.sellingPriceCents ? p.basePriceCents : null,
    soldCount,
    marginCents: estimateMarginCents(row.sellingPriceCents, p.basePriceCents),
    deliveryMin,
    deliveryMax,
    stock,
    freeShipping: p.freeShipping,
    storeName,
    isBestSeller: p.isBestSeller,
  }
}

const listingSelect = {
  id: true,
  sellingPriceCents: true,
  productId: true,
  product: {
    select: {
      id: true,
      name: true,
      images: true,
      basePriceCents: true,
      commissionRate: true,
      deliveryMin: true,
      deliveryMax: true,
    deliveryDays: true,
    isBestSeller: true,
    freeShipping: true,
    stock: true,
  },
  },
  affiliate: {
    select: { name: true, store: { select: { name: true } } },
  },
} as const

async function firstListingsByProductIds(productIds: string[]): Promise<Map<string, ListingRow>> {
  if (productIds.length === 0) return new Map()
  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...affiliateRoleMarketplaceWhere,
      isListed: true,
      productId: { in: productIds },
      product: { active: true, isDraft: false },
    },
    select: listingSelect,
    orderBy: { id: "asc" },
  })
  const map = new Map<string, ListingRow>()
  for (const l of listings) {
    if (!map.has(l.productId)) map.set(l.productId, l as ListingRow)
  }
  return map
}

async function soldCountsSince(since: Date, productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map()
  const rows = await prisma.order.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, createdAt: { gte: since } },
    _count: { id: true },
  })
  return new Map(rows.map((r) => [r.productId, r._count.id]))
}

function storeLabel(row: ListingRow): string {
  return publicPartnerSellerLabel({
    storeName: row.affiliate.store?.name,
    affiliateDisplayName: row.affiliate.name,
  })
}

export async function loadHomeMarketplaceStats(): Promise<HomeMarketplaceStats> {
  const [productCount, avgRow] = await Promise.all([
    prisma.product.count({ where: { active: true, isDraft: false } }),
    prisma.product.aggregate({
      where: { active: true, isDraft: false },
      _avg: { commissionRate: true },
    }),
  ])
  const avgCommissionPct = Math.round(avgRow._avg.commissionRate ?? 18)
  return {
    productCount,
    avgCommissionPct,
    productCountLabel: productCount.toLocaleString("fr-FR"),
    avgCommissionLabel: `${avgCommissionPct} %`,
  }
}

export async function loadHomeBestSellers7d(limit = 12): Promise<HomeProductCard[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * MS_DAY)
  const ranked = await prisma.$queryRaw<{ productId: string; c: bigint }[]>`
    SELECT o."productId", COUNT(*)::bigint AS c
    FROM "Order" o
    INNER JOIN "Product" p ON p.id = o."productId"
    WHERE o."createdAt" >= ${sevenDaysAgo}
      AND p.active = true
    GROUP BY o."productId"
    ORDER BY c DESC
    LIMIT ${limit}
  `
  const productIds = ranked.map((r) => r.productId)
  const [listingMap, soldMap] = await Promise.all([
    firstListingsByProductIds(productIds),
    soldCountsSince(sevenDaysAgo, productIds),
  ])

  return productIds
    .map((id) => {
      const row = listingMap.get(id)
      if (!row) return null
      return mapListingToHomeCard(row, soldMap.get(id) ?? Number(ranked.find((r) => r.productId === id)?.c ?? 0), storeLabel(row))
    })
    .filter((x): x is HomeProductCard => x != null)
}

export async function loadHomeNewArrivals(limit = 12): Promise<HomeProductCard[]> {
  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...affiliateRoleMarketplaceWhere,
      isListed: true,
      product: { active: true, isDraft: false },
    },
    select: listingSelect,
    orderBy: { product: { createdAt: "desc" } },
    take: 48,
  })

  const seen = new Set<string>()
  const cards: HomeProductCard[] = []
  for (const row of listings) {
    if (seen.has(row.productId)) continue
    seen.add(row.productId)
    cards.push(mapListingToHomeCard(row as ListingRow, 0, storeLabel(row as ListingRow)))
    if (cards.length >= limit) break
  }
  return cards
}

export async function loadHomeHighMargin(limit = 12): Promise<HomeProductCard[]> {
  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...affiliateRoleMarketplaceWhere,
      isListed: true,
      product: { active: true, isDraft: false },
    },
    select: listingSelect,
    take: 120,
  })

  const withMargin = listings
    .map((row) => {
      const margin = estimateMarginCents(row.sellingPriceCents, row.product.basePriceCents)
      return { row: row as ListingRow, margin }
    })
    .sort((a, b) => b.margin - a.margin)
    .slice(0, limit)

  return withMargin.map(({ row }) => mapListingToHomeCard(row, 0, storeLabel(row)))
}

export async function loadHomeHighlights(): Promise<HomeHighlightsData> {
  const [bestSellers7d, newArrivals, highMargin] = await Promise.all([
    loadHomeBestSellers7d(),
    loadHomeNewArrivals(),
    loadHomeHighMargin(),
  ])
  return { bestSellers7d, newArrivals, highMargin }
}

function categoryToSlug(name: string): string {
  const n = name.toLowerCase()
  if (n.includes("fitness") || n.includes("sport")) return "fitness"
  if (n.includes("électron") || n.includes("electron") || n.includes("informatique")) return "electronique"
  if (n.includes("maison") || n.includes("déco") || n.includes("deco") || n.includes("mobilier")) return "maison"
  return encodeURIComponent(
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "all"
  )
}

export async function loadHomeBarometer(): Promise<HomeBarometerData> {
  const now = Date.now()
  const currentStart = new Date(now - 30 * MS_DAY)
  const currentEnd = new Date(now)
  const prevStart = new Date(now - 60 * MS_DAY)
  const prevEnd = new Date(now - 30 * MS_DAY)

  const currentRows = await prisma.$queryRaw<{ category: string; total: bigint }[]>`
    SELECT sub.cat AS category, SUM(sub.amount)::bigint AS total
    FROM (
      SELECT unnest(p.categories) AS cat, o."sellingPriceCents" AS amount
      FROM "Order" o
      INNER JOIN "Product" p ON p.id = o."productId"
      WHERE o."createdAt" >= ${currentStart}
        AND o."createdAt" < ${currentEnd}
        AND cardinality(p.categories) > 0
        AND p.active = true
    ) sub
    GROUP BY sub.cat
  `

  const prevRows = await prisma.$queryRaw<{ category: string; total: bigint }[]>`
    SELECT sub.cat AS category, SUM(sub.amount)::bigint AS total
    FROM (
      SELECT unnest(p.categories) AS cat, o."sellingPriceCents" AS amount
      FROM "Order" o
      INNER JOIN "Product" p ON p.id = o."productId"
      WHERE o."createdAt" >= ${prevStart}
        AND o."createdAt" < ${prevEnd}
        AND cardinality(p.categories) > 0
        AND p.active = true
    ) sub
    GROUP BY sub.cat
  `

  const curMap = new Map(currentRows.map((r) => [r.category, Number(r.total)]))
  const prevMap = new Map(prevRows.map((r) => [r.category, Number(r.total)]))
  const marketTotalCents = [...curMap.values()].reduce((s, v) => s + v, 0) || 1
  const topCategories = [...curMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const categories: HomeBarometerCategory[] = topCategories.map(([name, totalCents]) => {
    const prev = prevMap.get(name) ?? 0
    let growthPct: number | null = null
    if (prev > 0) growthPct = Math.round(((totalCents - prev) / prev) * 1000) / 10
    return {
      category: name,
      categorySlug: categoryToSlug(name),
      totalCents,
      pctOfTop: Math.round((totalCents / marketTotalCents) * 1000) / 10,
      growthPct,
      isNew: prev === 0 && totalCents > 0,
      totalLabel: formatStoreCurrencyFromCents(totalCents, { maximumFractionDigits: 0 }),
    }
  })

  const chartData = categories.map((c) => ({
    name: c.category.length > 14 ? `${c.category.slice(0, 12)}…` : c.category,
    sales: c.totalCents / 100,
  }))

  return { categories, chartData }
}

export function homeProductToCardProps(item: HomeProductCard) {
  return {
    listingId: item.listingId,
    productId: item.productId,
    title: item.name,
    name: item.name,
    image: item.imageUrl ?? undefined,
    price: item.priceCents / 100,
    compareAt: item.compareAtCents != null ? item.compareAtCents / 100 : null,
    isBestSeller: item.isBestSeller,
    soldCount: item.soldCount,
    marginCents: item.marginCents,
    deliveryLabel: deliveryRangeLabel(item.deliveryMin, item.deliveryMax),
    store: item.storeName,
    stock: item.stock,
    freeShipping: item.freeShipping ?? false,
  }
}

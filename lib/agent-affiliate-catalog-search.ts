import type { Prisma, PrismaClient } from "@prisma/client"

import type {
  AffiliateAgentProductCard,
  AffiliateAgentSearchToolResult,
} from "@/lib/agent-affiliate-product-card-types"
import {
  buildAffiliateCatalogCardEconomics,
  estimateTotalPartnerGainCents,
  listedSellingPriceFromAffiliateProducts,
} from "@/lib/affiliate-catalog-margin-display"
import { affiliateCommissionDisplayPct } from "@/lib/affiliate-product-commission-display"
import { affiliateDiscoverCardSelect } from "@/lib/affiliate-dashboard-data"
import { primaryProductImage } from "@/lib/product-images"

function trimDescription(s: string, max = 320): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

type DiscoverRow = {
  id: string
  name: string
  description: string
  images: string[]
  basePriceCents: number
  commissionRate: number
  variants?: unknown
  categories: string[]
  affiliateProducts: { id: string; isListed: boolean; sellingPriceCents?: number | null }[]
  supplier: { email: string; store: { name: string; slug: string } | null }
}

type ProductFindRow = DiscoverRow & { variants?: unknown }

function resellerGainCents(row: DiscoverRow, displayCommission: number): number {
  return estimateTotalPartnerGainCents(row.basePriceCents, displayCommission, {
    listedSellingPriceCents: listedSellingPriceFromAffiliateProducts(row.affiliateProducts),
  })
}

function sortByResellerGain(rows: DiscoverRow[]): DiscoverRow[] {
  return [...rows].sort((a, b) => {
    const commA = affiliateCommissionDisplayPct({
      commissionRate: Number(a.commissionRate) || 0,
      variants: a.variants,
      basePriceCents: a.basePriceCents,
    })
    const commB = affiliateCommissionDisplayPct({
      commissionRate: Number(b.commissionRate) || 0,
      variants: b.variants,
      basePriceCents: b.basePriceCents,
    })
    return resellerGainCents(b, commB) - resellerGainCents(a, commA)
  })
}

function mapRow(row: DiscoverRow): AffiliateAgentProductCard {
  const listing = row.affiliateProducts[0]
  const supplierLabel = row.supplier.store?.name?.trim() || row.supplier.email
  const displayCommission = affiliateCommissionDisplayPct({
    commissionRate: Number(row.commissionRate) || 0,
    variants: row.variants,
    basePriceCents: row.basePriceCents,
  })
  const listedPrice = listedSellingPriceFromAffiliateProducts(row.affiliateProducts)
  const economics = buildAffiliateCatalogCardEconomics(row.basePriceCents, displayCommission, {
    listedSellingPriceCents: listedPrice,
  })
  return {
    id: row.id,
    name: row.name,
    imageUrl: primaryProductImage(row.images) || null,
    description: trimDescription(row.description ?? ""),
    supplierLabel,
    basePriceCents: row.basePriceCents,
    commissionRate: displayCommission,
    marginCents: economics.totalPartnerGainCents,
    clientPriceCents: economics.clientPriceCents,
    usesListedPrice: economics.usesListedPrice,
    isInStore: Boolean(listing),
    listingId: listing?.id ?? null,
  }
}

function toDiscoverRow(row: ProductFindRow): DiscoverRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    images: row.images ?? [],
    basePriceCents: row.basePriceCents,
    commissionRate: Number(row.commissionRate) || 0,
    variants: row.variants,
    categories: row.categories ?? [],
    affiliateProducts: row.affiliateProducts ?? [],
    supplier: row.supplier,
  }
}

async function findSimilarSupplierProducts(
  db: PrismaClient,
  affiliateId: string,
  main: AffiliateAgentProductCard[],
  q: string
): Promise<AffiliateAgentProductCard[]> {
  if (main.length === 0) return []
  const mainIds = main.map((m) => m.id)
  const detail = await db.product.findMany({
    where: { id: { in: mainIds }, active: true },
    select: { categories: true },
  })
  const cats = [
    ...new Set(detail.flatMap((d) => d.categories).filter((c) => typeof c === "string" && c.trim())),
  ]

  const or: Prisma.ProductWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
    { description: { contains: q, mode: "insensitive" } },
  ]
  if (cats.length > 0) {
    or.push({ categories: { hasSome: cats } })
  }

  const rows = await db.product.findMany({
    where: {
      active: true,
      isDraft: false,
      id: { notIn: mainIds },
      OR: or,
    },
    select: affiliateDiscoverCardSelect(affiliateId),
    take: 12,
    orderBy: [{ createdAt: "desc" }],
  })

  const sorted = sortByResellerGain(
    rows.map((row) =>
      toDiscoverRow({
        id: row.id,
        name: row.name,
        description: "",
        images: row.images ?? [],
        basePriceCents: row.basePriceCents,
        commissionRate: Number(row.commissionRate) || 0,
        variants: row.variants,
        categories: row.categories ?? [],
        affiliateProducts: row.affiliateProducts ?? [],
        supplier: row.supplier as unknown as DiscoverRow["supplier"],
      })
    )
  )
  return sorted.slice(0, 3).map(mapRow)
}

/** Recherche le catalogue fournisseur pour aider l'affilié à choisir des SKU à promouvoir. */
export async function searchSupplierCatalogForAffiliateAgent(
  db: PrismaClient,
  affiliateId: string,
  rawQuery: string
): Promise<AffiliateAgentSearchToolResult> {
  const q = rawQuery.trim()
  if (!q) {
    return { products: [], similarProducts: [], suggestedCategories: [] }
  }

  const rows = await db.product.findMany({
    where: {
      active: true,
      isDraft: false,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { categories: { hasSome: [q] } },
        { tags: { hasSome: [q] } },
      ],
    },
    select: {
      ...affiliateDiscoverCardSelect(affiliateId),
      description: true,
    },
    take: 24,
    orderBy: [{ createdAt: "desc" }],
  })

  const sorted = sortByResellerGain(
    rows.map((row) =>
      toDiscoverRow({
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        images: row.images ?? [],
        basePriceCents: row.basePriceCents,
        commissionRate: Number(row.commissionRate) || 0,
        variants: row.variants,
        categories: row.categories ?? [],
        affiliateProducts: row.affiliateProducts ?? [],
        supplier: row.supplier as unknown as DiscoverRow["supplier"],
      })
    )
  )
  const products = sorted.slice(0, 3).map(mapRow)

  if (products.length > 0) {
    const similarProducts = await findSimilarSupplierProducts(db, affiliateId, products, q)
    return { products, similarProducts, suggestedCategories: [] }
  }

  const sample = await db.product.findMany({
    where: { active: true, isDraft: false },
    select: { categories: true },
    take: 80,
  })
  const suggestedCategories = [
    ...new Set(sample.flatMap((s) => s.categories).filter((c) => typeof c === "string" && c.trim())),
  ].slice(0, 10)

  return { products: [], similarProducts: [], suggestedCategories }
}

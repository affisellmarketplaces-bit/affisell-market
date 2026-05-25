import type { Prisma, PrismaClient } from "@prisma/client"

import type {
  AffiliateAgentProductCard,
  AffiliateAgentSearchToolResult,
} from "@/lib/agent-affiliate-product-card-types"
import { affiliateCommissionDisplayPct } from "@/lib/affiliate-product-commission-display"
import { affiliateDiscoverCardSelect } from "@/lib/affiliate-dashboard-data"
import { primaryProductImage } from "@/lib/product-images"

function trimDescription(s: string, max = 320): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function estimateMarginCents(basePriceCents: number, commissionRate: number): number {
  return Math.max(0, Math.round((basePriceCents * (Number(commissionRate) || 0)) / 100))
}

function mapRow(
  row: {
    id: string
    name: string
    description: string
    images: string[]
    basePriceCents: number
    commissionRate: number
    variants?: unknown
    categories: string[]
    affiliateProducts: { id: string; isListed: boolean }[]
    supplier: { email: string; store: { name: string; slug: string } | null }
  }
): AffiliateAgentProductCard {
  const listing = row.affiliateProducts[0]
  const supplierLabel =
    row.supplier.store?.name?.trim() || row.supplier.email
  const displayCommission = affiliateCommissionDisplayPct({
    commissionRate: Number(row.commissionRate) || 0,
    variants: row.variants,
    basePriceCents: row.basePriceCents,
  })
  return {
    id: row.id,
    name: row.name,
    imageUrl: primaryProductImage(row.images) || null,
    description: trimDescription(row.description ?? ""),
    supplierLabel,
    basePriceCents: row.basePriceCents,
    commissionRate: displayCommission,
    marginCents: estimateMarginCents(row.basePriceCents, displayCommission),
    isInStore: Boolean(listing),
    listingId: listing?.id ?? null,
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
    take: 8,
    orderBy: [{ commissionRate: "desc" }, { createdAt: "desc" }],
  })

  const out: AffiliateAgentProductCard[] = []
  for (const row of rows) {
    out.push(
      mapRow({
        id: row.id,
        name: row.name,
        description: "",
        images: row.images ?? [],
        basePriceCents: row.basePriceCents,
        commissionRate: Number(row.commissionRate) || 0,
        categories: row.categories ?? [],
        affiliateProducts: row.affiliateProducts ?? [],
        supplier: row.supplier as unknown as {
          email: string
          store: { name: string; slug: string } | null
        },
      })
    )
    if (out.length >= 3) break
  }
  return out
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
    take: 16,
    orderBy: [{ commissionRate: "desc" }, { createdAt: "desc" }],
  })

  const products: AffiliateAgentProductCard[] = []
  for (const row of rows) {
    products.push(
      mapRow({
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        images: row.images ?? [],
        basePriceCents: row.basePriceCents,
        commissionRate: Number(row.commissionRate) || 0,
        categories: row.categories ?? [],
        affiliateProducts: row.affiliateProducts ?? [],
        supplier: row.supplier as unknown as {
          email: string
          store: { name: string; slug: string } | null
        },
      })
    )
    if (products.length >= 3) break
  }

  if (products.length > 0) {
    const main = products.slice(0, 3)
    const similarProducts = await findSimilarSupplierProducts(db, affiliateId, main, q)
    return { products: main, similarProducts, suggestedCategories: [] }
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

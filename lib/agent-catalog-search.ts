import type { Prisma, PrismaClient } from "@prisma/client"

import type { AgentProductCard, AgentSearchToolResult } from "@/lib/agent-product-card-types"
import {
  buyerListedAffiliateProductWhere,
  buyerMarketplaceProductWhere,
} from "@/lib/marketplace-buyer-product-filter"
import { primaryProductImage } from "@/lib/product-images"
import { publicPartnerSellerLabel } from "@/lib/public-seller-display"

function trimDescription(s: string, max = 400): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

async function findSimilarAffiliateListings(
  db: PrismaClient,
  main: AgentProductCard[],
  q: string
): Promise<AgentProductCard[]> {
  if (main.length === 0) return []
  const mainIds = main.map((m) => m.id)
  const detail = await db.product.findMany({
    where: { id: { in: mainIds }, ...buyerMarketplaceProductWhere },
    select: { categories: true },
  })
  const cats = [
    ...new Set(detail.flatMap((d) => d.categories).filter((c) => typeof c === "string" && c.trim())),
  ]

  const namePatterns: Prisma.ProductWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
  ]
  if (/montre/i.test(q)) {
    namePatterns.push({ name: { contains: "watch", mode: "insensitive" } })
    namePatterns.push({ name: { contains: "Watch", mode: "insensitive" } })
  }

  const productOr: Prisma.ProductWhereInput[] = [...namePatterns]
  if (cats.length > 0) {
    productOr.push({ categories: { hasSome: cats } })
  }

  const similarRows = await db.affiliateProduct.findMany({
    where: {
      ...buyerListedAffiliateProductWhere,
      product: {
        ...buyerMarketplaceProductWhere,
        id: { notIn: mainIds },
        OR: productOr,
      },
    },
    take: 12,
    orderBy: [{ product: { stock: "desc" } }, { id: "asc" }],
    select: {
      customTitle: true,
      customDescription: true,
      customImages: true,
      sellingPriceCents: true,
      affiliate: { select: { name: true, store: { select: { name: true } } } },
      product: {
        select: {
          id: true,
          name: true,
          description: true,
          images: true,
        },
      },
    },
  })

  const seen = new Set<string>()
  const out: AgentProductCard[] = []
  for (const row of similarRows) {
    const pid = row.product.id
    if (seen.has(pid)) continue
    seen.add(pid)
    const p = row.product
    const imageUrl =
      primaryProductImage(row.customImages as string[] | null | undefined) ||
      primaryProductImage(p.images) ||
      null
    const name = row.customTitle?.trim() || p.name
    const description = trimDescription(row.customDescription?.trim() || p.description)
    out.push({
      id: p.id,
      name,
      price: row.sellingPriceCents / 100,
      imageUrl,
      description,
      brand: publicPartnerSellerLabel({
        storeName: row.affiliate.store?.name,
        affiliateDisplayName: row.affiliate.name,
      }),
    })
    if (out.length >= 3) break
  }
  return out
}

/**
 * Search buyer-facing marketplace listings (`AffiliateProduct` with affiliate role).
 * Returns up to 3 main hits plus up to 3 similar listings (shared categories and/or name ILIKE, incl. montre → watch).
 */
export async function searchCatalogForAgent(
  db: PrismaClient,
  rawQuery: string
): Promise<AgentSearchToolResult> {
  const q = rawQuery.trim()
  if (!q) {
    return { products: [], similarProducts: [], suggestedCategories: [] }
  }

  const nameOrDescriptionMatch: Prisma.ProductWhereInput["OR"] = [
    { name: { contains: q, mode: "insensitive" } },
    { description: { contains: q, mode: "insensitive" } },
  ]

  const listingWhere: Prisma.AffiliateProductWhereInput = {
    ...buyerListedAffiliateProductWhere,
    product: {
      ...buyerMarketplaceProductWhere,
      OR: nameOrDescriptionMatch,
    },
  }

  const listingWhereAffiliateText: Prisma.AffiliateProductWhereInput = {
    ...buyerListedAffiliateProductWhere,
    product: buyerMarketplaceProductWhere,
    OR: [
      { customTitle: { contains: q, mode: "insensitive" } },
      { customDescription: { contains: q, mode: "insensitive" } },
    ],
  }

  const [fromListingsProduct, fromListingsAffiliateText] = await Promise.all([
    db.affiliateProduct.findMany({
      where: listingWhere,
      take: 12,
      orderBy: [{ product: { stock: "desc" } }, { id: "asc" }],
      select: {
        customTitle: true,
        customDescription: true,
        customImages: true,
        sellingPriceCents: true,
        affiliate: { select: { name: true, store: { select: { name: true } } } },
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            basePriceCents: true,
            images: true,
            supplier: { select: { name: true, store: { select: { name: true } } } },
          },
        },
      },
    }),
    db.affiliateProduct.findMany({
      where: listingWhereAffiliateText,
      take: 12,
      orderBy: [{ product: { stock: "desc" } }, { id: "asc" }],
      select: {
        customTitle: true,
        customDescription: true,
        customImages: true,
        sellingPriceCents: true,
        affiliate: { select: { name: true, store: { select: { name: true } } } },
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            basePriceCents: true,
            images: true,
            supplier: { select: { name: true, store: { select: { name: true } } } },
          },
        },
      },
    }),
  ])

  const mergedListings = [...fromListingsProduct, ...fromListingsAffiliateText]
  const seenListingProduct = new Set<string>()
  const products: AgentProductCard[] = []

  for (const row of mergedListings) {
    const pid = row.product.id
    if (seenListingProduct.has(pid)) continue
    seenListingProduct.add(pid)
    const p = row.product
    const imageUrl =
      primaryProductImage(row.customImages as string[] | null | undefined) ||
      primaryProductImage(p.images) ||
      null
    const name = row.customTitle?.trim() || p.name
    const description = trimDescription(row.customDescription?.trim() || p.description)
    products.push({
      id: p.id,
      name,
      price: row.sellingPriceCents / 100,
      imageUrl,
      description,
      brand: publicPartnerSellerLabel({
        storeName: row.affiliate.store?.name,
        affiliateDisplayName: row.affiliate.name,
      }),
    })
    if (products.length >= 3) break
  }

  if (products.length > 0) {
    const main = products.slice(0, 3)
    const similarProducts = await findSimilarAffiliateListings(db, main, q)
    return { products: main, similarProducts, suggestedCategories: [] }
  }

  const sample = await db.affiliateProduct.findMany({
    where: buyerListedAffiliateProductWhere,
    select: { product: { select: { categories: true } } },
    take: 120,
  })
  const suggestedCategories = [
    ...new Set(
      sample.flatMap((s) => s.product?.categories ?? []).filter((c) => typeof c === "string" && c.trim())
    ),
  ].slice(0, 12)

  return { products: [], similarProducts: [], suggestedCategories }
}

import "server-only"

import type { Prisma, PrismaClient } from "@prisma/client"

import {
  buyerListedAffiliateProductWhere,
  buyerMarketplaceProductWhere,
} from "@/lib/marketplace-buyer-product-filter"
import { expandMarketplaceSearchTerms } from "@/lib/marketplace-search"
import { primaryProductImage } from "@/lib/product-images"
import { publicPartnerSellerLabel } from "@/lib/public-seller-display"

import type { DonaProductHit, DonaSearchToolResult } from "@/lib/dona/dona-product-types"

type ListingRow = {
  id: string
  customTitle: string | null
  customDescription: string | null
  customImages: unknown
  sellingPriceCents: number
  affiliate: { name: string | null; store: { name: string | null } | null }
  product: {
    id: string
    name: string
    description: string | null
    images: unknown
  }
}

function buildProductFieldOr(terms: string[]): Prisma.ProductWhereInput["OR"] {
  const or: Prisma.ProductWhereInput["OR"] = []
  const seen = new Set<string>()
  for (const term of terms) {
    const t = term.trim()
    if (t.length < 2 || seen.has(t)) continue
    seen.add(t)
    or.push({ name: { contains: t, mode: "insensitive" } })
    or.push({ description: { contains: t, mode: "insensitive" } })
  }
  return or
}

function mapListingRow(row: ListingRow): DonaProductHit {
  const p = row.product
  const imageUrl =
    primaryProductImage(row.customImages as string[] | null | undefined) ||
    primaryProductImage(p.images as string[] | null | undefined) ||
    null
  const name = row.customTitle?.trim() || p.name
  return {
    listingId: row.id,
    productId: p.id,
    name,
    price: row.sellingPriceCents / 100,
    imageUrl,
    brand: publicPartnerSellerLabel({
      storeName: row.affiliate.store?.name,
      affiliateDisplayName: row.affiliate.name,
    }),
    url: `/marketplace/${row.id}`,
  }
}

const listingSelect = {
  id: true,
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
      categories: true,
    },
  },
} satisfies Prisma.AffiliateProductSelect

async function findSimilarListings(
  db: PrismaClient,
  main: DonaProductHit[],
  q: string
): Promise<DonaProductHit[]> {
  if (main.length === 0) return []
  const mainListingIds = main.map((m) => m.listingId)
  const mainProductIds = main.map((m) => m.productId)

  const detail = await db.product.findMany({
    where: { id: { in: mainProductIds }, ...buyerMarketplaceProductWhere },
    select: { categories: true },
  })
  const cats = [
    ...new Set(
      detail.flatMap((d) => d.categories).filter((c) => typeof c === "string" && c.trim())
    ),
  ]

  const namePatterns: Prisma.ProductWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
  ]
  if (/montre/i.test(q)) {
    namePatterns.push({ name: { contains: "watch", mode: "insensitive" } })
  }

  const productOr: Prisma.ProductWhereInput[] = [...namePatterns]
  if (cats.length > 0) {
    productOr.push({ categories: { hasSome: cats } })
  }

  const similarRows = await db.affiliateProduct.findMany({
    where: {
      ...buyerListedAffiliateProductWhere,
      id: { notIn: mainListingIds },
      product: {
        ...buyerMarketplaceProductWhere,
        id: { notIn: mainProductIds },
        OR: productOr,
      },
    },
    take: 12,
    orderBy: [{ product: { stock: "desc" } }, { id: "asc" }],
    select: listingSelect,
  })

  const seen = new Set<string>()
  const out: DonaProductHit[] = []
  for (const row of similarRows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(mapListingRow(row))
    if (out.length >= 3) break
  }
  return out
}

/**
 * Search buyer marketplace listings for Dona — returns real `/marketplace/{listingId}` URLs.
 */
export async function searchCatalogForDona(
  db: PrismaClient,
  rawQuery: string
): Promise<DonaSearchToolResult> {
  const q = rawQuery.trim()
  if (!q) {
    return { products: [], similarProducts: [], suggestedCategories: [] }
  }

  const searchTerms = expandMarketplaceSearchTerms(q)
  const nameOrDescriptionMatch = buildProductFieldOr(searchTerms.length > 0 ? searchTerms : [q])

  const affiliateTextOr: Prisma.AffiliateProductWhereInput["OR"] = searchTerms.flatMap((term) => {
    if (term.length < 2) return []
    return [
      { customTitle: { contains: term, mode: "insensitive" } },
      { customDescription: { contains: term, mode: "insensitive" } },
    ]
  })
  if (affiliateTextOr.length === 0) {
    affiliateTextOr.push(
      { customTitle: { contains: q, mode: "insensitive" } },
      { customDescription: { contains: q, mode: "insensitive" } }
    )
  }

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
    OR: affiliateTextOr,
  }

  const [fromListingsProduct, fromListingsAffiliateText] = await Promise.all([
    db.affiliateProduct.findMany({
      where: listingWhere,
      take: 12,
      orderBy: [{ product: { stock: "desc" } }, { id: "asc" }],
      select: listingSelect,
    }),
    db.affiliateProduct.findMany({
      where: listingWhereAffiliateText,
      take: 12,
      orderBy: [{ product: { stock: "desc" } }, { id: "asc" }],
      select: listingSelect,
    }),
  ])

  const seenListing = new Set<string>()
  const products: DonaProductHit[] = []

  for (const row of [...fromListingsProduct, ...fromListingsAffiliateText]) {
    if (seenListing.has(row.id)) continue
    seenListing.add(row.id)
    products.push(mapListingRow(row))
    if (products.length >= 3) break
  }

  if (products.length > 0) {
    const main = products.slice(0, 3)
    const similarProducts = await findSimilarListings(db, main, q)
    return { products: main, similarProducts, suggestedCategories: [] }
  }

  const sample = await db.affiliateProduct.findMany({
    where: buyerListedAffiliateProductWhere,
    select: { product: { select: { categories: true } } },
    take: 120,
  })
  const suggestedCategories = [
    ...new Set(
      sample
        .flatMap((s) => s.product?.categories ?? [])
        .filter((c) => typeof c === "string" && c.trim())
    ),
  ].slice(0, 12)

  return { products: [], similarProducts: [], suggestedCategories }
}

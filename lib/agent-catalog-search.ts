import type { Prisma, PrismaClient } from "@prisma/client"

import type { AgentProductCard, AgentSearchToolResult } from "@/lib/agent-product-card-types"
import { primaryProductImage } from "@/lib/product-images"

function brandFromSupplier(s: {
  name: string | null
  store: { name: string } | null
}): string {
  return s.store?.name?.trim() || s.name?.trim() || "Affisell"
}

function trimDescription(s: string, max = 400): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

async function findSimilarProducts(
  db: PrismaClient,
  main: AgentProductCard[],
  q: string
): Promise<AgentProductCard[]> {
  if (main.length === 0) return []
  const mainIds = main.map((m) => m.id)
  const detail = await db.product.findMany({
    where: { id: { in: mainIds }, active: true },
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

  const orBranches: Prisma.ProductWhereInput[] = [...namePatterns]
  if (cats.length > 0) {
    orBranches.push({ categories: { hasSome: cats } })
  }

  const similarRows = await db.product.findMany({
    where: {
      active: true,
      id: { notIn: mainIds },
      OR: orBranches,
    },
    take: 6,
    orderBy: [{ stock: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      basePriceCents: true,
      images: true,
      supplier: { select: { name: true, store: { select: { name: true } } } },
    },
  })

  return similarRows.slice(0, 3).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.basePriceCents / 100,
    imageUrl: primaryProductImage(p.images) || null,
    description: trimDescription(p.description),
    brand: brandFromSupplier(p.supplier),
  }))
}

/**
 * Search listed affiliate offers and base products. Prefers rows from `AffiliateProduct`
 * (custom images/titles and selling price), then fills from `Product` only.
 * Returns up to 3 main hits plus up to 3 similar products (shared categories and/or name ILIKE, incl. montre → watch).
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

  const textMatch: Prisma.ProductWhereInput = {
    active: true,
    OR: nameOrDescriptionMatch,
  }

  const listingWhere: Prisma.AffiliateProductWhereInput = {
    isListed: true,
    product: {
      active: true,
      OR: nameOrDescriptionMatch,
    },
  }

  const listingWhereAffiliateText: Prisma.AffiliateProductWhereInput = {
    isListed: true,
    product: { active: true },
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
      brand: brandFromSupplier(p.supplier),
    })
    if (products.length >= 3) break
  }

  if (products.length < 3) {
    const exclude = new Set(products.map((x) => x.id))
    const need = 3 - products.length
    const extras = await db.product.findMany({
      where: {
        ...textMatch,
        ...(exclude.size > 0 ? { id: { notIn: [...exclude] } } : {}),
      },
      take: need,
      orderBy: [{ stock: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        basePriceCents: true,
        images: true,
        supplier: { select: { name: true, store: { select: { name: true } } } },
      },
    })
    for (const p of extras) {
      products.push({
        id: p.id,
        name: p.name,
        price: p.basePriceCents / 100,
        imageUrl: primaryProductImage(p.images) || null,
        description: trimDescription(p.description),
        brand: brandFromSupplier(p.supplier),
      })
    }
  }

  if (products.length > 0) {
    const main = products.slice(0, 3)
    const similarProducts = await findSimilarProducts(db, main, q)
    return { products: main, similarProducts, suggestedCategories: [] }
  }

  const sample = await db.product.findMany({
    where: { active: true },
    select: { categories: true },
    take: 120,
  })
  const suggestedCategories = [
    ...new Set(sample.flatMap((p) => p.categories).filter((c) => typeof c === "string" && c.trim())),
  ].slice(0, 12)

  return { products: [], similarProducts: [], suggestedCategories }
}

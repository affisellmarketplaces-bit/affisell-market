import "server-only"

import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getRadarDb } from "@/lib/prisma-radar"
import type {
  RadarImportDestination,
  RadarImportJobProduct,
  RadarImportJobStatus,
} from "@/lib/radar/radar-import-types"
import {
  enrichRadarImport,
  formatEnrichEuro,
} from "@/lib/import/smart-import-enricher"
import type { WorldRadarWinnerDto } from "@/lib/radar/world-radar-types"
import { getWorldRadarPayload } from "@/lib/radar/world-radar-store.server"

const CUID_RE = /^c[a-z0-9]{20,30}$/i

function isLikelyCuid(value: string): boolean {
  return CUID_RE.test(value.trim())
}

function mapWinnerToImportProduct(w: WorldRadarWinnerDto): RadarImportJobProduct {
  return {
    winnerId: w.id,
    title: w.title,
    imageUrl: w.image,
    price: w.price,
    arbitrageScore: w.arbitrage?.score ?? w.finalScore ?? w.trendingScore ?? null,
    category: w.category ?? null,
    productId: w.productId ?? null,
    source: w.source,
  }
}

/** Resolve Radar winner IDs from live payload + market_intelli cache. */
export async function resolveRadarWinnersForImport(args: {
  winnerIds: string[]
  country: string
}): Promise<RadarImportJobProduct[]> {
  const code = args.country.trim().toUpperCase()
  const uniqueIds = [...new Set(args.winnerIds.map((id) => id.trim()).filter(Boolean))]
  if (uniqueIds.length === 0) return []

  const byId = new Map<string, RadarImportJobProduct>()

  try {
    const payload = await getWorldRadarPayload(code)
    for (const w of payload.winners) {
      if (uniqueIds.includes(w.id)) {
        byId.set(w.id, mapWinnerToImportProduct(w))
      }
    }
  } catch (err) {
    console.warn("[radar-import]", {
      step: "resolve_live_payload",
      country: code,
      message: err instanceof Error ? err.message : "unknown",
    })
  }

  const missing = uniqueIds.filter((id) => !byId.has(id))
  if (missing.length > 0) {
    try {
      const db = getRadarDb()
      const rows = await db.radarWinner.findMany({
        where: { id: { in: missing }, countryCode: code },
      })
      for (const row of rows) {
        byId.set(row.id, {
          winnerId: row.id,
          title: row.title,
          imageUrl: row.image,
          price: row.price,
          arbitrageScore: row.trendingScore,
          category: row.category,
          source: row.source,
        })
      }
    } catch (err) {
      console.warn("[radar-import]", {
        step: "resolve_radar_db",
        country: code,
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  return uniqueIds
    .map((id) => byId.get(id))
    .filter((p): p is RadarImportJobProduct => Boolean(p))
}

async function resolveCatalogProductId(
  winner: RadarImportJobProduct
): Promise<string | null> {
  if (winner.catalogListingId && isLikelyCuid(winner.catalogListingId)) {
    const listing = await prisma.affiliateProduct.findUnique({
      where: { id: winner.catalogListingId },
      select: { productId: true },
    })
    if (listing) return listing.productId
  }

  if (winner.winnerId && isLikelyCuid(winner.winnerId)) {
    const listing = await prisma.affiliateProduct.findUnique({
      where: { id: winner.winnerId },
      select: { productId: true },
    })
    if (listing) return listing.productId
  }

  if (winner.productId && isLikelyCuid(winner.productId)) {
    const product = await prisma.product.findFirst({
      where: { id: winner.productId, active: true },
      select: { id: true },
    })
    if (product) return product.id
  }

  const title = winner.title.trim()
  if (title.length >= 4) {
    const product = await prisma.product.findFirst({
      where: {
        active: true,
        isDraft: false,
        name: { contains: title.slice(0, 48), mode: "insensitive" },
      },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    })
    if (product) return product.id
  }

  return null
}

function radarSourceTag(country: string): string {
  return `world_radar_${country.trim().toUpperCase()}`
}

async function createAffiliateDraftFromWinner(args: {
  affiliateId: string
  country: string
  winner: RadarImportJobProduct
}): Promise<RadarImportJobProduct> {
  const productId = await resolveCatalogProductId(args.winner)
  if (!productId) {
    return {
      ...args.winner,
      importError: "no_matching_catalog_product",
    }
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
    select: { id: true, basePriceCents: true, images: true },
  })
  if (!product) {
    return { ...args.winner, importError: "catalog_product_inactive" }
  }

  const enriched = await enrichRadarImport(
    {
      title: args.winner.title,
      price: args.winner.price,
      category: args.winner.category,
      countryCode: args.country,
      source: args.winner.source,
    },
    args.country
  )

  const title = enriched.title
  const originalPrice = enriched.costPrice
  const price = enriched.salePrice
  const description =
    `${enriched.seoDescription}\n\n` +
    `💰 Arbitrage: Acheté ${formatEnrichEuro(enriched.costPrice)}€ → Vendu ${formatEnrichEuro(enriched.salePrice)}€ = +${formatEnrichEuro(enriched.profit)}€ (x${enriched.multiplier.toFixed(1)})`

  const sourceTag = radarSourceTag(args.country)
  const saleCents = Math.round(price * 100)
  const costCents = Math.round(originalPrice * 100)
  // Floor at catalog base so checkout constraints stay valid; prefer smart sale price.
  const sellingPriceCents = Math.max(saleCents, product.basePriceCents)
  const marginCents = Math.max(0, sellingPriceCents - Math.max(costCents, product.basePriceCents))
  const customImages =
    args.winner.imageUrl?.trim()
      ? [args.winner.imageUrl.trim()]
      : product.images.filter(Boolean).slice(0, 1)

  const customDescription = `${description}\n\nRadar import · source=${sourceTag} · cost=${originalPrice}`

  const listing = await prisma.affiliateProduct.upsert({
    where: {
      affiliateId_productId: { affiliateId: args.affiliateId, productId: product.id },
    },
    create: {
      affiliateId: args.affiliateId,
      productId: product.id,
      sellingPriceCents,
      marginCents,
      customTitle: title,
      customImages,
      customDescription,
      isListed: false,
    },
    update: {
      customTitle: title,
      sellingPriceCents,
      marginCents,
      customImages: customImages.length > 0 ? customImages : undefined,
      customDescription,
      isListed: false,
    },
    select: { id: true },
  })

  console.log("[radar-import]", {
    step: "affiliate_draft_enriched",
    listingId: listing.id,
    salePrice: price,
    costPrice: originalPrice,
    country: args.country,
  })

  return {
    ...args.winner,
    title,
    originalTitle: enriched.originalTitle,
    price,
    costPrice: originalPrice,
    salePrice: price,
    enrichMultiplier: enriched.multiplier,
    importedListingId: listing.id,
    importError: null,
  }
}

export async function createRadarImportJob(args: {
  userId: string
  country: string
  destination: RadarImportDestination
  products: RadarImportJobProduct[]
}): Promise<{ jobId: string; count: number; redirectUrl?: string; importedCount: number }> {
  const country = args.country.trim().toUpperCase()
  let status: RadarImportJobStatus = "pending"
  let products: RadarImportJobProduct[] = args.products

  if (args.destination === "affisell_catalog") {
    status = "processing"
    const resolved: RadarImportJobProduct[] = []
    for (const winner of args.products) {
      resolved.push(
        await createAffiliateDraftFromWinner({
          affiliateId: args.userId,
          country,
          winner,
        })
      )
    }
    products = resolved
    const importedCount = resolved.filter((p) => p.importedListingId).length
    status = importedCount > 0 ? "completed" : "failed"
  }

  const job = await prisma.importJob.create({
    data: {
      userId: args.userId,
      status,
      source: "radar",
      sourceCountry: country,
      products: products as unknown as Prisma.InputJsonValue,
      destination: args.destination,
    },
    select: { id: true },
  })

  console.log("[radar-import]", {
    jobId: job.id,
    userId: args.userId,
    country,
    destination: args.destination,
    count: products.length,
    status,
  })

  const redirectUrl =
    args.destination === "supplier_draft"
      ? `/dashboard/supplier/products/new?prefill=${job.id}`
      : undefined

  return {
    jobId: job.id,
    count: products.length,
    redirectUrl,
    importedCount:
      args.destination === "affisell_catalog"
        ? products.filter((p) => p.importedListingId).length
        : products.length,
  }
}

export async function getRadarImportJobForUser(args: {
  jobId: string
  userId: string
}): Promise<{
  id: string
  status: string
  sourceCountry: string
  destination: string
  products: RadarImportJobProduct[]
} | null> {
  const job = await prisma.importJob.findFirst({
    where: { id: args.jobId, userId: args.userId },
    select: {
      id: true,
      status: true,
      sourceCountry: true,
      destination: true,
      products: true,
    },
  })
  if (!job) return null

  const products = Array.isArray(job.products)
    ? (job.products as RadarImportJobProduct[])
    : []

  return {
    id: job.id,
    status: job.status,
    sourceCountry: job.sourceCountry,
    destination: job.destination,
    products,
  }
}

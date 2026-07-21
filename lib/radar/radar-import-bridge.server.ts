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
  RADAR_BULK_IMPORT_MAX,
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
  const uniqueIds = [...new Set(args.winnerIds.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    RADAR_BULK_IMPORT_MAX
  )
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

/** Top N winners for a country (live payload → market_intelli fallback). */
export async function resolveAllCountryWinnersForImport(args: {
  country: string
  limit?: number
}): Promise<RadarImportJobProduct[]> {
  const code = args.country.trim().toUpperCase()
  const limit = Math.min(Math.max(args.limit ?? RADAR_BULK_IMPORT_MAX, 1), RADAR_BULK_IMPORT_MAX)

  try {
    const payload = await getWorldRadarPayload(code)
    const sorted = [...payload.winners].sort((a, b) => {
      const sa = a.finalScore ?? a.arbitrage?.score ?? a.trendingScore ?? 0
      const sb = b.finalScore ?? b.arbitrage?.score ?? b.trendingScore ?? 0
      return sb - sa
    })
    if (sorted.length > 0) {
      return sorted.slice(0, limit).map(mapWinnerToImportProduct)
    }
  } catch (err) {
    console.warn("[radar-import]", {
      step: "resolve_all_live",
      country: code,
      message: err instanceof Error ? err.message : "unknown",
    })
  }

  try {
    const db = getRadarDb()
    const rows = await db.radarWinner.findMany({
      where: { countryCode: code, expiresAt: { gt: new Date() } },
      orderBy: { trendingScore: "desc" },
      take: limit,
    })
    return rows.map((row) => ({
      winnerId: row.id,
      title: row.title,
      imageUrl: row.image,
      price: row.price,
      arbitrageScore: row.trendingScore,
      category: row.category,
      source: row.source,
    }))
  } catch (err) {
    console.warn("[radar-import]", {
      step: "resolve_all_radar_db",
      country: code,
      message: err instanceof Error ? err.message : "unknown",
    })
    return []
  }
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

async function prepareEnrichedDraftRow(args: {
  affiliateId: string
  country: string
  winner: RadarImportJobProduct
}): Promise<{
  product: RadarImportJobProduct
  createData: {
    affiliateId: string
    productId: string
    sellingPriceCents: number
    marginCents: number
    customTitle: string
    customImages: string[]
    customDescription: string
    isListed: boolean
  } | null
}> {
  const productId = await resolveCatalogProductId(args.winner)
  if (!productId) {
    return {
      product: { ...args.winner, importError: "no_matching_catalog_product" },
      createData: null,
    }
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
    select: { id: true, basePriceCents: true, images: true },
  })
  if (!product) {
    return {
      product: { ...args.winner, importError: "catalog_product_inactive" },
      createData: null,
    }
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
  const sellingPriceCents = Math.max(saleCents, product.basePriceCents)
  const marginCents = Math.max(0, sellingPriceCents - Math.max(costCents, product.basePriceCents))
  const customImages =
    args.winner.imageUrl?.trim()
      ? [args.winner.imageUrl.trim()]
      : product.images.filter(Boolean).slice(0, 1)

  const customDescription = `${description}\n\nRadar import · source=${sourceTag} · cost=${originalPrice}`

  return {
    product: {
      ...args.winner,
      title,
      originalTitle: enriched.originalTitle,
      price,
      costPrice: originalPrice,
      salePrice: price,
      enrichMultiplier: enriched.multiplier,
      importError: null,
    },
    createData: {
      affiliateId: args.affiliateId,
      productId: product.id,
      sellingPriceCents,
      marginCents,
      customTitle: title,
      customImages,
      customDescription,
      isListed: false,
    },
  }
}

/** Bulk create drafts via createMany (+ update existing unique pairs). */
async function createAffiliateDraftsBulk(args: {
  affiliateId: string
  country: string
  winners: RadarImportJobProduct[]
}): Promise<RadarImportJobProduct[]> {
  const prepared = []
  for (const winner of args.winners.slice(0, RADAR_BULK_IMPORT_MAX)) {
    prepared.push(
      await prepareEnrichedDraftRow({
        affiliateId: args.affiliateId,
        country: args.country,
        winner,
      })
    )
  }

  const withDataRaw = prepared.filter((p) => p.createData != null)
  // One AffiliateProduct per catalog productId (unique affiliateId+productId).
  const seenProduct = new Set<string>()
  const withData = withDataRaw.filter((p) => {
    const id = p.createData!.productId
    if (seenProduct.has(id)) return false
    seenProduct.add(id)
    return true
  })
  const productIds = withData.map((p) => p.createData!.productId)

  const existing = productIds.length
    ? await prisma.affiliateProduct.findMany({
        where: {
          affiliateId: args.affiliateId,
          productId: { in: productIds },
        },
        select: { id: true, productId: true },
      })
    : []
  const existingByProduct = new Map(existing.map((e) => [e.productId, e.id]))

  const toCreate = withData
    .filter((p) => !existingByProduct.has(p.createData!.productId))
    .map((p) => p.createData!)

  if (toCreate.length > 0) {
    await prisma.affiliateProduct.createMany({
      data: toCreate,
      skipDuplicates: true,
    })
  }

  const toUpdate = withData.filter((p) => existingByProduct.has(p.createData!.productId))
  for (const row of toUpdate) {
    const data = row.createData!
    await prisma.affiliateProduct.update({
      where: {
        affiliateId_productId: {
          affiliateId: args.affiliateId,
          productId: data.productId,
        },
      },
      data: {
        customTitle: data.customTitle,
        sellingPriceCents: data.sellingPriceCents,
        marginCents: data.marginCents,
        customImages: data.customImages.length > 0 ? data.customImages : undefined,
        customDescription: data.customDescription,
        isListed: false,
      },
    })
  }

  // Re-fetch created IDs for job payload
  const after = productIds.length
    ? await prisma.affiliateProduct.findMany({
        where: { affiliateId: args.affiliateId, productId: { in: productIds } },
        select: { id: true, productId: true },
      })
    : []
  const idByProduct = new Map(after.map((a) => [a.productId, a.id]))

  console.log("[radar-import]", {
    step: "affiliate_drafts_bulk",
    created: toCreate.length,
    updated: toUpdate.length,
    country: args.country,
  })

  return prepared.map((p) => {
    if (!p.createData) return p.product
    return {
      ...p.product,
      importedListingId: idByProduct.get(p.createData.productId) ?? null,
    }
  })
}

export async function createRadarImportJob(args: {
  userId: string
  country: string
  destination: RadarImportDestination
  products: RadarImportJobProduct[]
}): Promise<{
  jobId: string
  count: number
  redirectUrl?: string
  importedCount: number
  totalMargin: number
}> {
  const country = args.country.trim().toUpperCase()
  const capped = args.products.slice(0, RADAR_BULK_IMPORT_MAX)
  let status: RadarImportJobStatus = "pending"
  let products: RadarImportJobProduct[] = capped

  if (args.destination === "affisell_catalog") {
    status = "processing"
    products = await createAffiliateDraftsBulk({
      affiliateId: args.userId,
      country,
      winners: capped,
    })
    const importedCount = products.filter((p) => p.importedListingId).length
    status = importedCount > 0 ? "completed" : "failed"
  } else {
    // Enrich pricing snapshot into job JSON (no AffiliateProduct writes).
    const enrichedProducts: RadarImportJobProduct[] = []
    for (const winner of capped) {
      const enriched = await enrichRadarImport(
        {
          title: winner.title,
          price: winner.price,
          category: winner.category,
          countryCode: country,
          source: winner.source,
        },
        country
      )
      enrichedProducts.push({
        ...winner,
        title: enriched.title,
        originalTitle: enriched.originalTitle,
        price: enriched.salePrice,
        costPrice: enriched.costPrice,
        salePrice: enriched.salePrice,
        enrichMultiplier: enriched.multiplier,
      })
    }
    products = enrichedProducts
    status = "completed"
  }

  const totalMargin = products.reduce((sum, p) => {
    if (p.salePrice != null && p.costPrice != null) {
      return sum + (p.salePrice - p.costPrice)
    }
    return sum
  }, 0)

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
    totalMargin: Math.round(totalMargin * 100) / 100,
    status,
  })

  const redirectUrl =
    args.destination === "supplier_draft"
      ? `/dashboard/supplier/products/new?prefill=${job.id}`
      : `/dashboard/imports/${job.id}`

  return {
    jobId: job.id,
    count: products.length,
    redirectUrl,
    importedCount:
      args.destination === "affisell_catalog"
        ? products.filter((p) => p.importedListingId).length
        : products.length,
    totalMargin: Math.round(totalMargin * 100) / 100,
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

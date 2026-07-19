import "server-only"

import type { Prisma } from ".prisma/client-mi"

import { getRadarDb } from "@/lib/prisma-radar"
import { utcDay } from "@/lib/radar/writers/product-writer"
import {
  normalizeFromSnapshot,
  type NormalizedStandardProduct,
  type SnapshotNormalizeInput,
} from "@/lib/radar/writers/standard-product-normalize"

export type { NormalizedStandardProduct, SnapshotNormalizeInput }
export {
  normalizeFromSnapshot,
  normalizeTitle,
  normalizeBrand,
  normalizeCurrency,
  currencyForCountry,
  parsePrice,
  pickImageUrl,
} from "@/lib/radar/writers/standard-product-normalize"

/** Legacy TikTok/OAuth shop upsert input. */
export type StandardProductWriteInput = {
  connectorId: string
  externalId: string
  shopId?: string | null
  title?: string | null
  currency?: string | null
  price?: number | null
  sales?: number | null
  rank?: number | null
  views?: number | null
  region?: string | null
  country?: string | null
  brand?: string | null
  imageUrl?: string | null
  link?: string | null
  description?: string | null
  raw?: Prisma.InputJsonValue
  day?: Date
}

export type UpsertFromSnapshotResult = {
  id: string
  created: boolean
  day: Date
  normalized: NormalizedStandardProduct
}

/**
 * Normalize RadarGlobalSnapshot → StandardProduct and upsert.
 * Unique: connectorId(=marketplaceId) + externalId + country + day
 */
export async function upsertStandardProductFromSnapshot(
  input: SnapshotNormalizeInput & { day?: Date; sales?: number | null; rank?: number | null }
): Promise<UpsertFromSnapshotResult | null> {
  const normalized = normalizeFromSnapshot(input)
  if (!normalized) {
    console.warn("[radar/writers/standard-product]", {
      result: "skip_invalid",
      marketplaceId: input.marketplaceId,
      externalId: input.externalId,
    })
    return null
  }

  if (normalized.price <= 0) {
    console.log("[radar/writers/standard-product]", {
      result: "upsert_out_of_stock",
      marketplaceId: normalized.marketplaceId,
      externalId: normalized.externalId,
      country: normalized.country,
    })
  }

  const day = utcDay(input.day ?? new Date())
  const db = getRadarDb()

  const whereUnique = {
    connectorId_externalId_country_day: {
      connectorId: normalized.marketplaceId,
      externalId: normalized.externalId,
      country: normalized.country,
      day,
    },
  } satisfies Prisma.StandardProductWhereUniqueInput

  const existing = await db.standardProduct.findUnique({
    where: whereUnique,
    select: { id: true },
  })

  const row = await db.standardProduct.upsert({
    where: whereUnique,
    create: {
      connectorId: normalized.marketplaceId,
      externalId: normalized.externalId,
      country: normalized.country,
      title: normalized.title,
      description: normalized.description,
      brand: normalized.brand,
      price: normalized.price,
      currency: normalized.currency,
      imageUrl: normalized.imageUrl || null,
      link: normalized.link || null,
      availability: normalized.availability,
      condition: normalized.condition,
      sales: input.sales ?? null,
      rank: input.rank ?? null,
      region: normalized.country,
      day,
      raw: {
        mpn: normalized.mpn,
        gtin: normalized.gtin,
        source: "radar_global_snapshot",
      },
    },
    update: {
      title: normalized.title,
      description: normalized.description,
      brand: normalized.brand,
      price: normalized.price,
      currency: normalized.currency,
      imageUrl: normalized.imageUrl || null,
      link: normalized.link || null,
      availability: normalized.availability,
      condition: normalized.condition,
      sales: input.sales ?? null,
      rank: input.rank ?? null,
      region: normalized.country,
      raw: {
        mpn: normalized.mpn,
        gtin: normalized.gtin,
        source: "radar_global_snapshot",
      },
    },
    select: { id: true },
  })

  console.log("[radar/writers/standard-product]", {
    result: existing ? "updated" : "created",
    marketplaceId: normalized.marketplaceId,
    externalId: normalized.externalId,
    country: normalized.country,
    day: day.toISOString().slice(0, 10),
  })

  return { id: row.id, created: !existing, day, normalized }
}

/**
 * Idempotent StandardProduct upsert (shop OAuth / legacy).
 * Unique: connectorId + externalId + country + day
 */
export async function upsertStandardProduct(
  input: StandardProductWriteInput
): Promise<{ id: string; created: boolean; day: Date }> {
  const fromSnap = await upsertStandardProductFromSnapshot({
    marketplaceId: input.connectorId,
    externalId: input.externalId,
    title: input.title ?? input.externalId,
    price: input.price,
    currency: input.currency,
    imageUrl: input.imageUrl,
    brand: input.brand,
    country: input.country ?? input.region ?? "US",
    url: input.link,
    day: input.day,
    sales: input.sales,
    rank: input.rank,
  })

  if (!fromSnap) {
    throw new Error("[radar/writers/standard-product] invalid input for upsert")
  }

  // Preserve shopId when provided (TikTok shop catalog)
  if (input.shopId) {
    await getRadarDb().standardProduct.update({
      where: { id: fromSnap.id },
      data: {
        shopId: input.shopId,
        views: input.views ?? undefined,
        ...(input.raw ? { raw: input.raw } : {}),
      },
    })
  }

  return { id: fromSnap.id, created: fromSnap.created, day: fromSnap.day }
}

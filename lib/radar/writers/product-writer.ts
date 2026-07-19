import "server-only"

import type { Prisma } from ".prisma/client-mi"

import { getRadarDb } from "@/lib/prisma-radar"

export type ProductSnapshotWriteInput = {
  /** Alias for externalId within marketplace+country (audit "productId"). */
  productId?: string
  marketplaceId: string
  externalId: string
  title: string
  price: number
  category?: string | null
  country: string
  rank?: number | null
  salesEst?: number | null
  url?: string | null
  currency?: string | null
  imageUrl?: string | null
  crawledAt?: Date
  day?: Date
}

export type ProductSnapshotWriteResult = {
  id: string
  created: boolean
  day: Date
}

/** UTC midnight Date for DATE column upsert keys. */
export function utcDay(date: Date = new Date()): Date {
  const day = new Date(date)
  day.setUTCHours(0, 0, 0, 0)
  return day
}

/**
 * Idempotent daily ProductSnapshot upsert (RadarGlobalSnapshot).
 * where: productId(=externalId) + marketplace + country + day
 */
export async function upsertProductSnapshot(
  input: ProductSnapshotWriteInput
): Promise<ProductSnapshotWriteResult> {
  const crawledAt = input.crawledAt ?? new Date()
  const day = utcDay(input.day ?? crawledAt)
  const externalId = input.externalId || input.productId
  if (!externalId) {
    throw new Error("[radar/writers] productId or externalId required")
  }

  const db = getRadarDb()
  const whereUnique = {
    marketplaceId_externalId_country_day: {
      marketplaceId: input.marketplaceId,
      externalId,
      country: input.country,
      day,
    },
  } satisfies Prisma.RadarGlobalSnapshotWhereUniqueInput

  const existing = await db.radarGlobalSnapshot.findUnique({
    where: whereUnique,
    select: { id: true },
  })

  const row = await db.radarGlobalSnapshot.upsert({
    where: whereUnique,
    create: {
      marketplaceId: input.marketplaceId,
      externalId,
      title: input.title,
      price: input.price,
      category: input.category ?? null,
      country: input.country,
      day,
      rank: input.rank ?? null,
      salesEst: input.salesEst ?? null,
      url: input.url ?? null,
      currency: input.currency ?? null,
      imageUrl: input.imageUrl ?? null,
      crawledAt,
    },
    update: {
      title: input.title,
      price: input.price,
      category: input.category ?? null,
      rank: input.rank ?? null,
      salesEst: input.salesEst ?? null,
      url: input.url ?? null,
      currency: input.currency ?? null,
      imageUrl: input.imageUrl ?? null,
      crawledAt,
    },
    select: { id: true },
  })

  console.log("[radar/writers/product]", {
    result: existing ? "updated" : "created",
    productId: externalId,
    marketplaceId: input.marketplaceId,
    country: input.country,
    day: day.toISOString().slice(0, 10),
  })

  return { id: row.id, created: !existing, day }
}

/** @deprecated Use upsertProductSnapshot — kept for call sites named global-scan. */
export const upsertGlobalSnapshot = upsertProductSnapshot
export type GlobalSnapshotWriteInput = ProductSnapshotWriteInput
export type GlobalSnapshotWriteResult = ProductSnapshotWriteResult

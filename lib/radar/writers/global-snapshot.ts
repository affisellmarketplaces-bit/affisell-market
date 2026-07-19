import "server-only"

import type { Prisma } from ".prisma/client-mi"

import { getRadarDb } from "@/lib/prisma-radar"

export type GlobalSnapshotWriteInput = {
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
  /** Override UTC day; defaults to UTC calendar day of crawledAt/now. */
  day?: Date
}

export type GlobalSnapshotWriteResult = {
  id: string
  created: boolean
  day: Date
}

/** UTC midnight for the calendar day of `date` (stable upsert key). */
export function utcDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * Idempotent daily snapshot upsert.
 * Unique: marketplaceId + externalId + country + day
 * (productId ≡ externalId within a marketplace/country).
 */
export async function upsertGlobalSnapshot(
  input: GlobalSnapshotWriteInput
): Promise<GlobalSnapshotWriteResult> {
  const crawledAt = input.crawledAt ?? new Date()
  const day = utcDay(input.day ?? crawledAt)
  const db = getRadarDb()

  const whereUnique = {
    marketplaceId_externalId_country_day: {
      marketplaceId: input.marketplaceId,
      externalId: input.externalId,
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
      externalId: input.externalId,
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

  console.log("[radar/writers]", {
    result: existing ? "updated" : "created",
    marketplaceId: input.marketplaceId,
    externalId: input.externalId,
    country: input.country,
    day: day.toISOString().slice(0, 10),
  })

  return { id: row.id, created: !existing, day }
}

import "server-only"

import type { Prisma } from ".prisma/client-mi"

import { getRadarDb } from "@/lib/prisma-radar"
import { utcDay } from "@/lib/radar/writers/product-writer"

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
  raw?: Prisma.InputJsonValue
  day?: Date
}

/**
 * Idempotent StandardProduct upsert — @@unique([connectorId, externalId, day]).
 */
export async function upsertStandardProduct(
  input: StandardProductWriteInput
): Promise<{ id: string; created: boolean; day: Date }> {
  const day = utcDay(input.day ?? new Date())
  const db = getRadarDb()

  const whereUnique = {
    connectorId_externalId_day: {
      connectorId: input.connectorId,
      externalId: input.externalId,
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
      connectorId: input.connectorId,
      externalId: input.externalId,
      shopId: input.shopId ?? null,
      title: input.title ?? null,
      currency: input.currency ?? null,
      price: input.price ?? null,
      sales: input.sales ?? null,
      rank: input.rank ?? null,
      views: input.views ?? null,
      region: input.region ?? null,
      day,
      raw: input.raw ?? undefined,
    },
    update: {
      shopId: input.shopId ?? null,
      title: input.title ?? null,
      currency: input.currency ?? null,
      price: input.price ?? null,
      sales: input.sales ?? null,
      rank: input.rank ?? null,
      views: input.views ?? null,
      region: input.region ?? null,
      raw: input.raw ?? undefined,
    },
    select: { id: true },
  })

  console.log("[radar/writers/standard-product]", {
    result: existing ? "updated" : "created",
    connectorId: input.connectorId,
    externalId: input.externalId,
    day: day.toISOString().slice(0, 10),
  })

  return { id: row.id, created: !existing, day }
}

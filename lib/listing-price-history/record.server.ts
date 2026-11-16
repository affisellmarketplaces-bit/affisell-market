import "server-only"

import type { Prisma, PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  isListingPriceSource,
  sanitizeListingPriceActor,
  type ListingPriceSource,
} from "@/lib/listing-price-history/sources"

type Raw = Pick<PrismaClient, "$queryRaw">

/**
 * Declares, for the CURRENT transaction only (`set_config(…, true)`), who is changing a reseller's selling price, so the
 * database trigger can record it in ListingPriceHistory. It records nothing by itself: the trigger does, for every
 * writer. Must run inside the same transaction as the write (interactive `tx`, or first item of a batch transaction).
 */
export function declareListingPriceSource(
  client: Raw,
  args: { source: ListingPriceSource; actorId?: string | null }
): Prisma.PrismaPromise<unknown> {
  const source = isListingPriceSource(args.source) ? args.source : "unattributed"
  const actor = sanitizeListingPriceActor(args.actorId) ?? ""
  return client.$queryRaw`SELECT set_config('affisell.listing_price_source', ${source}, true)::text AS s, set_config('affisell.listing_price_actor', ${actor}, true)::text AS a`
}

/**
 * `prisma.affiliateProduct.update({ where, data })` with its price-change source declared, in one transaction.
 */
export async function updateListingWithPriceSource(
  args: { where: Prisma.AffiliateProductWhereUniqueInput; data: Prisma.AffiliateProductUpdateInput },
  declared: { source: ListingPriceSource; actorId?: string | null }
) {
  const [, updated] = await prisma.$transaction([
    declareListingPriceSource(prisma, declared),
    prisma.affiliateProduct.update({ where: args.where, data: args.data }),
  ])
  return updated
}

/** `prisma.affiliateProduct.upsert` with its price-change source declared, in one transaction. */
export async function upsertListingWithPriceSource(
  args: Prisma.AffiliateProductUpsertArgs,
  declared: { source: ListingPriceSource; actorId?: string | null }
) {
  const [, row] = await prisma.$transaction([declareListingPriceSource(prisma, declared), prisma.affiliateProduct.upsert(args)])
  return row
}

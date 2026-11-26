import "server-only"

import type { PrismaClient } from "@prisma/client"

// The declaration helpers live in `declare.ts` (no `server-only`): scripts and seeds use them too.
export { declareListingPresenceSource, withListingPresenceSource } from "@/lib/listing-presence/declare"

/**
 * Account deletion of a reseller (no order — `deleteMerchantUser`): its presence history serves nothing once the account
 * is gone, so it is deleted in the SAME transaction (after the listing deletions, which append their own events). The
 * append-only guard lets a DELETE through only with the purge flag of this transaction. A missing table (migration not
 * applied) is not an error.
 */
export async function purgeAffiliatePresenceInTransaction(tx: unknown, affiliateId: string): Promise<number> {
  const t = tx as Partial<Pick<PrismaClient, "$queryRaw" | "$executeRaw">>
  if (typeof t.$queryRaw !== "function" || typeof t.$executeRaw !== "function") return 0
  const rows = (await t.$queryRaw`SELECT to_regclass('"ListingPresenceEvent"')::text AS t`) as Array<{ t: string | null }>
  if (!rows[0]?.t) return 0
  await t.$queryRaw`SELECT set_config('affisell.listing_presence_purge', 'on', true)::text AS p`
  return t.$executeRaw`DELETE FROM "ListingPresenceEvent" WHERE "affiliateId" = ${affiliateId}`
}

/**
 * Retention PROPOSAL (founder decision, NOT scheduled): events older than `LISTING_PRESENCE_RETENTION_DAYS` serve no
 * commercial analysis Affisell runs (the longest window read is 12 months; 24 months keeps one year of comparison).
 * Without `apply: true` it only counts. With it, it deletes in ONE transaction under the purge flag. A purge makes the
 * start of the oldest periods unknown again — the rebuild then says « début inconnu », it never invents a date.
 */
export const LISTING_PRESENCE_RETENTION_DAYS = 730
export const PRESENCE_PURGE_ACTION = "listing_presence.purged"

export async function purgeExpiredListingPresence(opts: { apply: boolean; now?: Date }): Promise<{ expired: number; deleted: number }> {
  const { prisma } = await import("@/lib/prisma")
  const limit = new Date((opts.now ?? new Date()).getTime() - LISTING_PRESENCE_RETENTION_DAYS * 86_400_000)
  const expired = await prisma.listingPresenceEvent.count({ where: { effectiveAt: { lt: limit } } })
  if (!opts.apply || expired === 0) return { expired, deleted: 0 }
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('affisell.listing_presence_purge', 'on', true)::text AS p`
    const n = await tx.$executeRaw`DELETE FROM "ListingPresenceEvent" WHERE "effectiveAt" < ${limit}`
    // The readers move the start of history to this limit: before it, presence is unknown again (never assumed).
    await tx.auditLog.createMany({
      data: [{ id: `listing-presence-purge:${limit.toISOString()}`, action: PRESENCE_PURGE_ACTION, entityType: "ListingPresenceEvent", entityId: limit.toISOString(), payload: { limit: limit.toISOString(), deleted: n } }],
      skipDuplicates: true,
    })
    return n
  })
  return { expired, deleted }
}

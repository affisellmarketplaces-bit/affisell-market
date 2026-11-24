import type { Prisma, PrismaClient } from "@prisma/client"

import { isListingPresenceSource, sanitizePresenceActor, type ListingPresenceSource } from "./sources"

/**
 * The ONE way to say who changes a listing's life (creation, listing, unlisting, deletion). No `server-only` on purpose:
 * the application, maintenance scripts and seeds all declare through it, so every writer reaches the same database
 * mechanism (`set_config('affisell.listing_presence_source', …, true)` read by the trigger of migration
 * 20261124090000_listing_presence_history). Relative imports only, so `tsx` scripts can load it.
 */
type Raw = Pick<PrismaClient, "$queryRaw">

/**
 * Declares, for the CURRENT transaction only (`set_config(…, true)`), who is changing a listing's presence, so the
 * database trigger records it in ListingPresenceEvent. It records nothing by itself — the trigger records EVERY
 * presence change, declared or not. Must run inside the same transaction as the write (interactive `tx`, or first item
 * of a batch transaction). Setting a configuration parameter works whether or not the history table exists.
 */
export function declareListingPresenceSource(
  client: Raw,
  args: { source: ListingPresenceSource; actorId?: string | null },
): Prisma.PrismaPromise<unknown> | Promise<unknown> {
  // Test doubles of a transaction may not implement raw queries: the declaration is optional by design.
  if (typeof (client as { $queryRaw?: unknown }).$queryRaw !== "function") return Promise.resolve(null)
  const source = isListingPresenceSource(args.source) ? args.source : "unattributed"
  const actor = sanitizePresenceActor(args.actorId) ?? ""
  return client.$queryRaw`SELECT set_config('affisell.listing_presence_source', ${source}, true)::text AS s, set_config('affisell.listing_presence_actor', ${actor}, true)::text AS a`
}

/**
 * Runs `op` in ONE transaction with the presence source declared first. Given a client already inside a transaction,
 * the declaration is made in that transaction. A test double without raw queries runs `op` alone (the trigger would
 * record `unattributed`).
 */
export async function withListingPresenceSource<T>(
  client: unknown,
  declared: { source: ListingPresenceSource; actorId?: string | null },
  op: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const c = client as { $transaction?: (fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T> }
  if (typeof c.$transaction !== "function") {
    // Already a transaction client (an interactive `tx` has no `$transaction`): declare INSIDE that transaction, then
    // write. It used to skip the declaration here, so a write passed a `tx` was recorded as « unattributed ».
    await declareListingPresenceSource(client as Raw, declared)
    return op(client as Prisma.TransactionClient)
  }
  return c.$transaction(async (tx) => {
    await declareListingPresenceSource(tx, declared)
    return op(tx)
  })
}


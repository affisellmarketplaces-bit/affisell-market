/**
 * Capture Sentinel — the runner (talks to a database). Pure judgement in `capture-sentinel.ts`.
 *
 * Contract:
 * - Nothing connects before `decideSentinelDestination` said yes. A refused destination returns NOT_RUN and the
 *   `connect` factory is never called.
 * - The probe runs in ONE interactive transaction that is ALWAYS rolled back. It writes through the application's own
 *   path: Prisma, plus the source declared with `declareListingPresenceSource`.
 * - After the transaction, a separate read checks what survived. Everything must be zero.
 * - `cleanupSentinelResidue` exists only for residue a broken run might have COMMITTED (a bug, a hand-made test row). It
 *   deletes only rows that carry BOTH sentinel markers, in one transaction, and only on an allowed destination.
 *
 * No `server-only`, relative imports only: the `probe:capture-sentinel` script and the CI test load it as is.
 */
import { declareListingPresenceSource } from "./declare"
import {
  SENTINEL_ID_PREFIX,
  SENTINEL_PROBE_TIME_ZONE,
  SENTINEL_SOURCE,
  SENTINEL_STEPS,
  evaluateSentinel,
  sentinelIds,
  sentinelNotRun,
  type ObservedEvent,
  type SentinelDestination,
  type SentinelIds,
  type SentinelObservations,
  type SentinelResult,
  type SentinelStepId,
  type StepObservation,
} from "./capture-sentinel"

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tx = any
/** A Prisma client (or the same shape). Typed loosely so tests can pass an extended / guarded client. */
export type SentinelClient = any

class SentinelRollback extends Error {
  constructor() {
    super("capture_sentinel_rollback")
  }
}

const iso = (d: unknown) => (d instanceof Date && Number.isFinite(d.getTime()) ? d.toISOString() : null)

async function utcClock(tx: Tx): Promise<string | null> {
  const rows = (await tx.$queryRaw`SELECT (clock_timestamp() AT TIME ZONE 'UTC') AS t`) as Array<{ t: Date }>
  return iso(rows[0]?.t)
}

async function eventsOf(tx: Tx, listingId: string): Promise<ObservedEvent[]> {
  const rows = (await tx.listingPresenceEvent.findMany({ where: { affiliateProductId: listingId }, orderBy: { id: "asc" } })) as Array<Record<string, unknown>>
  return rows.map((r) => ({
    kind: String(r.kind),
    previousListed: typeof r.previousListed === "boolean" ? r.previousListed : null,
    newListed: typeof r.newListed === "boolean" ? r.newListed : null,
    source: String(r.source),
    actorId: typeof r.actorId === "string" ? r.actorId : null,
    affiliateProductId: String(r.affiliateProductId),
    affiliateId: String(r.affiliateId),
    productId: String(r.productId),
    effectiveAt: iso(r.effectiveAt) ?? "",
  }))
}

/** What survived the probe, read OUTSIDE its transaction. Read-only. */
export async function readSentinelResidue(client: SentinelClient, ids?: SentinelIds) {
  const like = ids ? null : `${SENTINEL_ID_PREFIX}%`
  const byId = (id: string) => (like ? { startsWith: SENTINEL_ID_PREFIX } : id)
  const [listings, events, products, users, priceRows] = await Promise.all([
    client.affiliateProduct.count({ where: { id: byId(ids?.listingId ?? "") } }),
    client.listingPresenceEvent.count({ where: like ? { OR: [{ source: SENTINEL_SOURCE }, { affiliateProductId: { startsWith: SENTINEL_ID_PREFIX } }] } : { affiliateProductId: ids!.listingId } }),
    client.product.count({ where: { id: byId(ids?.productId ?? "") } }),
    client.user.count({ where: ids ? { id: { in: [ids.supplierId, ids.affiliateId] } } : { id: { startsWith: SENTINEL_ID_PREFIX } } }),
    client.listingPriceHistory ? client.listingPriceHistory.count({ where: ids ? { affiliateProductId: ids.listingId } : { affiliateProductId: { startsWith: SENTINEL_ID_PREFIX } } }).catch(() => 0) : Promise.resolve(0),
  ])
  return { listings: Number(listings), events: Number(events), products: Number(products), users: Number(users), priceRows: Number(priceRows) }
}

export type SentinelHooks = {
  /** Tests only: called inside the transaction after each step (e.g. to interrupt the connection). */
  afterStep?: (step: SentinelStepId, tx: Tx) => Promise<void>
}

/** Runs the probe. Never throws: every problem becomes part of the result. */
export async function runCaptureSentinel(args: {
  destination: SentinelDestination
  connect: () => SentinelClient | Promise<SentinelClient>
  runId?: string
  now?: () => Date
  hooks?: SentinelHooks
}): Promise<SentinelResult> {
  const now = args.now ?? (() => new Date())
  const d = args.destination
  if (!d.allowed) return sentinelNotRun(now(), `${d.code} : ${d.reason}`)
  const ids = sentinelIds(args.runId ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)
  const obs: SentinelObservations = { takenAt: now().toISOString(), historyTableExists: null, setup: "not_run", steps: [], listingGoneInTransaction: null, ending: "not_started", residue: null }
  let client: SentinelClient
  try {
    client = await args.connect()
    const t = (await client.$queryRaw`SELECT to_regclass('"ListingPresenceEvent"')::text AS t`) as Array<{ t: string | null }>
    obs.historyTableExists = Boolean(t[0]?.t)
  } catch {
    return sentinelNotRun(now(), "connexion impossible à la base de test", d.environment)
  }
  if (!obs.historyTableExists) return evaluateSentinel(obs, ids, d.environment)

  try {
    await client.$transaction(
      async (tx: Tx) => {
        await tx.$queryRaw`SELECT set_config('TimeZone', ${SENTINEL_PROBE_TIME_ZONE}, true)::text AS z`
        try {
          await tx.user.create({ data: { id: ids.supplierId, email: `${ids.supplierId}@sentinel.invalid`, role: "SUPPLIER", name: "capture-sentinel" } })
          await tx.user.create({ data: { id: ids.affiliateId, email: `${ids.affiliateId}@sentinel.invalid`, role: "AFFILIATE", name: "capture-sentinel" } })
          await tx.product.create({ data: { id: ids.productId, supplierId: ids.supplierId, name: "capture-sentinel", description: "capture-sentinel", basePriceCents: 1000, commissionRate: 10, active: false, isDraft: true } })
          obs.setup = "ok"
        } catch {
          obs.setup = "failed"
          throw new SentinelRollback()
        }
        // The ONLY place the sentinel changes a listing's life (registered in LISTING_MUTATION_REGISTRY). The source is
        // declared in this transaction right before each mutation.
        const mutate = async (step: SentinelStepId) => {
          await declareListingPresenceSource(tx, { source: "capture_sentinel", actorId: ids.actorId })
          if (step === "create") {
            await tx.affiliateProduct.create({ data: { id: ids.listingId, affiliateId: ids.affiliateId, productId: ids.productId, sellingPriceCents: 1000, isListed: false } })
          } else if (step === "delete") {
            await tx.affiliateProduct.delete({ where: { id: ids.listingId } })
          } else {
            const data = step === "list" ? { isListed: true } : step === "noop" ? { isListed: true, position: 1 } : { isListed: false }
            await tx.affiliateProduct.update({ where: { id: ids.listingId }, data })
          }
        }
        let seen = 0
        for (const def of SENTINEL_STEPS) {
          const step: StepObservation = { id: def.id, mutation: "not_run", before: null, after: null, events: [] }
          obs.steps.push(step)
          step.before = await utcClock(tx)
          try {
            await mutate(def.id)
            step.mutation = "ok"
          } catch {
            // The database refused the mutation; PostgreSQL aborts the transaction, so nothing more can be read in it.
            step.mutation = "failed"
            throw new SentinelRollback()
          }
          step.after = await utcClock(tx)
          const evs = await eventsOf(tx, ids.listingId)
          step.events = evs.slice(seen)
          seen = evs.length
          await args.hooks?.afterStep?.(def.id, tx)
        }
        obs.listingGoneInTransaction = (await tx.affiliateProduct.count({ where: { id: ids.listingId } })) === 0
        throw new SentinelRollback()
      },
      { timeout: 30_000, maxWait: 10_000 },
    )
    obs.ending = "interrupted" // unreachable: the probe always throws to roll back
  } catch (e) {
    obs.ending = e instanceof SentinelRollback ? "rolled_back" : "interrupted"
  }
  try {
    obs.residue = await readSentinelResidue(client, ids)
  } catch {
    obs.residue = null
  }
  return evaluateSentinel(obs, ids, d.environment)
}

export type SentinelCleanupResult =
  | { done: false; reason: string; residueBefore: null }
  | { done: true; residueBefore: Awaited<ReturnType<typeof readSentinelResidue>>; residueAfter: Awaited<ReturnType<typeof readSentinelResidue>> }

/**
 * Removes residue a broken run might have COMMITTED. A normal probe leaves none (always rolled back). Only rows with
 * BOTH sentinel markers go: an id under `capture-sentinel-`, and for history events also the source `capture_sentinel`
 * (a real reseller's event can never carry both). One transaction: an interrupted cleanup changes nothing, and running
 * it again is safe. Refused on any destination the probe itself would refuse.
 */
export async function cleanupSentinelResidue(args: {
  destination: SentinelDestination
  connect: () => SentinelClient | Promise<SentinelClient>
  hooks?: { afterListings?: (tx: Tx) => Promise<void> }
}): Promise<SentinelCleanupResult> {
  if (!args.destination.allowed) return { done: false, reason: `${args.destination.code} : ${args.destination.reason}`, residueBefore: null }
  const client = await args.connect()
  const residueBefore = await readSentinelResidue(client)
  await client.$transaction(async (tx: Tx) => {
    await declareListingPresenceSource(tx, { source: "capture_sentinel", actorId: "sentinel:cleanup" })
    await tx.affiliateProduct.deleteMany({ where: { id: { startsWith: SENTINEL_ID_PREFIX }, productId: { startsWith: SENTINEL_ID_PREFIX } } })
    await args.hooks?.afterListings?.(tx)
    await tx.$queryRaw`SELECT set_config('affisell.listing_presence_purge', 'on', true)::text AS p`
    await tx.listingPresenceEvent.deleteMany({ where: { source: SENTINEL_SOURCE, affiliateProductId: { startsWith: SENTINEL_ID_PREFIX } } })
    if (tx.listingPriceHistory) await tx.listingPriceHistory.deleteMany({ where: { affiliateProductId: { startsWith: SENTINEL_ID_PREFIX }, productId: { startsWith: SENTINEL_ID_PREFIX } } })
    await tx.product.deleteMany({ where: { id: { startsWith: SENTINEL_ID_PREFIX }, name: "capture-sentinel" } })
    await tx.user.deleteMany({ where: { id: { startsWith: SENTINEL_ID_PREFIX }, name: "capture-sentinel" } })
  })
  return { done: true, residueBefore, residueAfter: await readSentinelResidue(client) }
}

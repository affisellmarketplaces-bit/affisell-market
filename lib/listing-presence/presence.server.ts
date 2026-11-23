import "server-only"

import { PRESENCE_PURGE_ACTION } from "@/lib/listing-presence/record.server"
import { prisma } from "@/lib/prisma"
import {
  presenceSummary,
  rebuildPresence,
  type PresenceEvent,
  type PresenceHistory,
  type PresenceKind,
} from "@/lib/listing-presence/periods"

/**
 * READ-ONLY reads of the listing presence history (rules: periods.ts). Writes nothing — the database trigger records.
 * Every read is defensive: a database without the migration answers « history unavailable », never a crash and never
 * an invented period.
 */
export const PRESENCE_MIGRATION = "20261124090000_listing_presence_history"
export const PRESENCE_MAX_EVENTS = 200_000
const KINDS: readonly PresenceKind[] = ["created", "listed", "unlisted", "deleted"]

const isMissingTable = (e: unknown) => /ListingPresenceEvent|P2021|does not exist|_prisma_migrations/i.test(e instanceof Error ? e.message : String(e))

/**
 * When the presence history that is still KEPT began: the migration's finished_at, moved forward to the limit of the
 * latest retention purge (before it, events were deleted, so presence is unknown again). null = not applied, rolled
 * back or unreadable.
 */
export async function loadPresenceTrackingStart(): Promise<Date | null> {
  try {
    const rows = (await prisma.$queryRaw`
      SELECT "finished_at" AS f FROM "_prisma_migrations"
      WHERE "migration_name" = ${PRESENCE_MIGRATION} AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
      ORDER BY "finished_at" ASC LIMIT 1`) as Array<{ f: Date | null }>
    const started = rows[0]?.f ?? null
    if (!started) return null
    const purge = await prisma.auditLog.findFirst({ where: { action: PRESENCE_PURGE_ACTION }, orderBy: { createdAt: "desc" }, select: { entityId: true } })
    const limit = purge?.entityId ? new Date(purge.entityId) : null
    return limit && Number.isFinite(limit.getTime()) && limit > started ? limit : started
  } catch (error) {
    if (!isMissingTable(error)) console.error("[listing-presence] tracking_start_unreadable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

type Row = { affiliateProductId: string; affiliateId: string; productId: string; kind: string; previousListed: boolean | null; newListed: boolean | null; source: string; effectiveAt: Date }
const toEvent = (r: Row): PresenceEvent | null =>
  KINDS.includes(r.kind as PresenceKind) ? { kind: r.kind as PresenceKind, previousListed: r.previousListed, newListed: r.newListed, effectiveAt: r.effectiveAt, source: r.source } : null

/** ONE listing of ONE reseller (both keys always in the read — never another reseller's history). null = not its listing. */
export async function loadListingPresence(affiliateId: string, listingId: string, now = new Date()) {
  const listing = await prisma.affiliateProduct.findFirst({ where: { id: listingId, affiliateId }, select: { id: true, isListed: true, createdAt: true } })
  if (!listing) return null
  const trackingStartedAt = await loadPresenceTrackingStart()
  if (!trackingStartedAt) return { available: false as const, listingId }
  try {
    const rows = (await prisma.listingPresenceEvent.findMany({
      where: { affiliateProductId: listing.id, affiliateId },
      orderBy: { id: "asc" },
      take: 5_000,
      select: { affiliateProductId: true, affiliateId: true, productId: true, kind: true, previousListed: true, newListed: true, source: true, effectiveAt: true },
    })) as Row[]
    const history = rebuildPresence({
      current: { isListed: listing.isListed, createdAt: listing.createdAt },
      events: rows.map(toEvent).filter((e): e is PresenceEvent => e != null),
      trackingStartedAt,
    })
    return { available: true as const, listingId, trackingStartedAt, history, summary: presenceSummary(history, now) }
  } catch (error) {
    if (isMissingTable(error)) return { available: false as const, listingId }
    throw error
  }
}

/**
 * Presence of EVERY listing (live, withdrawn or deleted) of the given products — the input future engines (blind-spot
 * detector, copilot learning, performance per listing-day) will read instead of today's live listings. Internal only:
 * callers aggregate before showing anything. `truncated` = a capped read (never used partially by a caller).
 */
export async function loadPresenceForProducts(
  productIds: readonly string[],
): Promise<{ available: boolean; truncated: boolean; trackingStartedAt: Date | null; listings: Array<{ listingId: string; affiliateId: string; productId: string; history: PresenceHistory }> }> {
  const trackingStartedAt = await loadPresenceTrackingStart()
  if (!trackingStartedAt || productIds.length === 0) return { available: Boolean(trackingStartedAt), truncated: false, trackingStartedAt, listings: [] }
  try {
    const [current, rows] = await Promise.all([
      prisma.affiliateProduct.findMany({ where: { productId: { in: [...productIds] } }, select: { id: true, affiliateId: true, productId: true, isListed: true, createdAt: true } }),
      prisma.listingPresenceEvent.findMany({
        where: { productId: { in: [...productIds] } },
        orderBy: { id: "asc" },
        take: PRESENCE_MAX_EVENTS + 1,
        select: { affiliateProductId: true, affiliateId: true, productId: true, kind: true, previousListed: true, newListed: true, source: true, effectiveAt: true },
      }) as Promise<Row[]>,
    ])
    const truncated = rows.length > PRESENCE_MAX_EVENTS
    const byListing = new Map<string, { affiliateId: string; productId: string; events: PresenceEvent[] }>()
    for (const r of rows.slice(0, PRESENCE_MAX_EVENTS)) {
      const e = toEvent(r)
      if (!e) continue
      const cur = byListing.get(r.affiliateProductId) ?? { affiliateId: r.affiliateId, productId: r.productId, events: [] }
      cur.events.push(e)
      byListing.set(r.affiliateProductId, cur)
    }
    const currentBy = new Map(current.map((c) => [c.id, c]))
    const ids = new Set([...currentBy.keys(), ...byListing.keys()])
    const listings = [...ids].map((id) => {
      const c = currentBy.get(id)
      const ev = byListing.get(id)
      return {
        listingId: id,
        affiliateId: c?.affiliateId ?? ev!.affiliateId,
        productId: c?.productId ?? ev!.productId,
        history: rebuildPresence({ current: c ? { isListed: c.isListed, createdAt: c.createdAt } : null, events: ev?.events ?? [], trackingStartedAt }),
      }
    })
    return { available: true, truncated, trackingStartedAt, listings }
  } catch (error) {
    if (isMissingTable(error)) return { available: false, truncated: false, trackingStartedAt: null, listings: [] }
    throw error
  }
}

/**
 * How presence events are attributed (founder brief 2026-11-24 §6): counts per declared source over a window, so the
 * share of « unattributed » events is measured, not assumed. Aggregates only; null = history unavailable.
 */
export async function loadPresenceSourceCoverage(days = 90, now = new Date()): Promise<{ total: number; bySource: Record<string, number>; unattributedShare: number | null } | null> {
  try {
    const rows = await prisma.listingPresenceEvent.groupBy({
      by: ["source"],
      where: { effectiveAt: { gte: new Date(now.getTime() - days * 86_400_000) } },
      _count: { _all: true },
    })
    const bySource: Record<string, number> = {}
    let total = 0
    for (const r of rows) {
      bySource[r.source] = r._count._all
      total += r._count._all
    }
    return { total, bySource, unattributedShare: total > 0 ? Math.round(((bySource.unattributed ?? 0) / total) * 1000) / 1000 : null }
  } catch (error) {
    if (isMissingTable(error)) return null
    throw error
  }
}

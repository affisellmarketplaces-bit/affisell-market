import "server-only"

import { unstable_cache } from "next/cache"

import { readHistoricalExposureMode } from "@/lib/listing-presence/exposure"
import { loadPresenceForProducts } from "@/lib/listing-presence/presence.server"
import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import {
  buildSnapshot,
  LEARNING_RETENTION_DAYS,
  parseSnapshot,
  planLearningPurge,
  readCopilotLearningMode,
  type ProposalCase,
  type ShopOrder,
  type SituationTrack,
} from "@/lib/reseller-copilot/learning"
import { presenceForCase } from "@/lib/reseller-copilot/learning-exposure"
import { buildLearningReport, type LearningReport } from "@/lib/reseller-copilot/learning-report"
import type { SelectionItem } from "@/lib/reseller-copilot/selection"

/**
 * Learning loop of the reseller copilot (rules: learning.ts). Storage = `AuditLog`, no migration, no new identifier:
 *  - `copilot.proposal_shown`  id `copilot-proposal:<affiliate>:<product>:<YYYY-MM-DD>` — the FROZEN snapshot of a product
 *    the copilot really served to that reseller account (closed list of fields, no free text), once per day;
 *  - `copilot.listing_added`   id `copilot-add:<affiliate>:<product>` — the reseller added it through the copilot.
 * Everything else is READ from records Affisell already keeps (the listing's creation date, the shop's orders).
 * Purpose: improve the copilot's advice to resellers — business records of a signed-in professional using a B2B tool,
 * not browsing analytics: no cookie, no browser identifier, nothing about buyers. Kept `LEARNING_RETENTION_DAYS`.
 * `COPILOT_LEARNING_MODE` = `off` (DEFAULT: nothing written, nothing read) | `observe` | `on`. Never fails the request it
 * observes. Never changes the ranking.
 */
export const PROPOSAL_ACTION = "copilot.proposal_shown"
export const COPILOT_ADD_ACTION = "copilot.listing_added"
export const proposalId = (affiliateId: string, productId: string, day: string) => `copilot-proposal:${affiliateId}:${productId}:${day}`
export const copilotAddId = (affiliateId: string, productId: string) => `copilot-add:${affiliateId}:${productId}`
const DAY = 86_400_000
export const LEARNING_MAX_PROPOSALS = 50_000
export const LEARNING_MAX_ORDERS = 100_000

export async function recordProposalSnapshots(
  affiliateId: string,
  items: ReadonlyArray<SelectionItem & { categoryId?: string | null; supplierPriceCents: number; ageDays: number | null; offerMissing: number | null; stockKnown: boolean }>,
  ctx: { shopListings: number | null; now?: Date },
): Promise<void> {
  if (readCopilotLearningMode() === "off") return
  const now = ctx.now ?? new Date()
  const day = now.toISOString().slice(0, 10)
  const rows = items
    .filter((i) => i.opportunity && i.readiness !== "bloque")
    .map((i, idx) => {
      const o = i.opportunity!
      const payload = buildSnapshot({
        profile: o.profile,
        flags: o.flags,
        rank: idx + 1,
        rankCriterion: o.rankedAbove?.criterion ?? null,
        readiness: i.readiness === "a_verifier" ? "a_verifier" : "pret",
        netCents: o.earnings.netCents,
        feeBps: o.earnings.feeBps,
        feeDefault: o.earnings.feeIsDefault,
        missing: o.missing.map((m) => m.code),
        fit: i.fit,
        categoryId: i.categoryId ?? null,
        supplierPriceCents: i.supplierPriceCents,
        paidOrders30d: i.demand.paidOrders30d,
        resellersListing: i.demand.resellersListing,
        ageDays: i.ageDays,
        offerMissingMeasured: i.offerMissing,
        rising: i.trend.rising,
        stockKnown: i.stockKnown,
        shopListings: ctx.shopListings,
      })
      return { id: proposalId(affiliateId, i.productId, day), action: PROPOSAL_ACTION, entityType: "Product", entityId: i.productId, actorId: affiliateId, payload }
    })
  if (rows.length === 0) return
  try {
    await prisma.auditLog.createMany({ data: rows, skipDuplicates: true })
  } catch (error) {
    console.error("[copilot-learning] snapshot_failed", error instanceof Error ? error.message : "unknown")
  }
}

export async function recordCopilotAdds(affiliateId: string, productIds: ReadonlyArray<string>): Promise<void> {
  if (readCopilotLearningMode() === "off" || productIds.length === 0) return
  try {
    await prisma.auditLog.createMany({
      data: productIds.map((p) => ({ id: copilotAddId(affiliateId, p), action: COPILOT_ADD_ACTION, entityType: "Product", entityId: p, actorId: affiliateId, payload: { v: 1 } })),
      skipDuplicates: true,
    })
  } catch (error) {
    console.error("[copilot-learning] add_record_failed", error instanceof Error ? error.message : "unknown")
  }
}

/** READ-ONLY: the first snapshot of each (reseller, product) + its listing + that shop's orders of it. */
export async function loadLearningCases(now = new Date()): Promise<{ cases: ProposalCase[]; truncated: boolean }> {
  const since = new Date(now.getTime() - LEARNING_RETENTION_DAYS * DAY)
  const rows = await prisma.auditLog.findMany({
    where: { action: PROPOSAL_ACTION, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: LEARNING_MAX_PROPOSALS + 1,
    select: { actorId: true, entityId: true, createdAt: true, payload: true },
  })
  let truncated = rows.length > LEARNING_MAX_PROPOSALS
  const first = new Map<string, (typeof rows)[number]>()
  for (const r of rows.slice(0, LEARNING_MAX_PROPOSALS)) {
    if (!r.actorId || !r.entityId) continue
    const k = `${r.actorId}\u0000${r.entityId}`
    if (!first.has(k)) first.set(k, r)
  }
  const affiliates = [...new Set([...first.values()].map((r) => r.actorId!))]
  const products = [...new Set([...first.values()].map((r) => r.entityId!))]
  if (first.size === 0) return { cases: [], truncated }
  const [listings, orders, adds] = await Promise.all([
    prisma.affiliateProduct.findMany({ where: { affiliateId: { in: affiliates }, productId: { in: products } }, select: { affiliateId: true, productId: true, createdAt: true } }),
    prisma.order.findMany({
      where: { affiliateId: { in: affiliates }, productId: { in: products }, paidAt: { gte: since } },
      select: {
        affiliateId: true, productId: true, paidAt: true, quantity: true, subtotalCents: true, sellingPriceCents: true, status: true, paymentSettlementStatus: true,
        affiliatePayoutCents: true, affiliateMarginRetainedCents: true, affiliateFeeCents: true, affiliateMarginCents: true,
      },
      take: LEARNING_MAX_ORDERS + 1,
    }),
    prisma.auditLog.findMany({ where: { action: COPILOT_ADD_ACTION, createdAt: { gte: since } }, select: { id: true }, take: LEARNING_MAX_PROPOSALS }),
  ])
  if (orders.length > LEARNING_MAX_ORDERS) truncated = true
  const listingBy = new Map(listings.map((l) => [`${l.affiliateId}\u0000${l.productId}`, l.createdAt]))
  const ordersBy = new Map<string, ShopOrder[]>()
  for (const o of orders.slice(0, LEARNING_MAX_ORDERS)) {
    if (!o.paidAt) continue
    const k = `${o.affiliateId}\u0000${o.productId}`
    const qty = Math.max(1, o.quantity ?? 1)
    ordersBy.set(k, [
      ...(ordersBy.get(k) ?? []),
      {
        paidAt: o.paidAt,
        quantity: qty,
        revenueHtCents: o.subtotalCents ?? o.sellingPriceCents * qty,
        netCents: netAffiliateTransferCents({ affiliatePayoutCents: o.affiliatePayoutCents, affiliateMarginRetainedCents: o.affiliateMarginRetainedCents, affiliateFeeCents: o.affiliateFeeCents, affiliateMarginCents: o.affiliateMarginCents }),
        closed: isOrderClosedForPayout({ status: o.status, paymentSettlementStatus: o.paymentSettlementStatus }),
      },
    ])
  }
  const addIds = new Set(adds.map((a) => a.id))
  // Presence history (HISTORICAL_EXPOSURE_MODE observe / on): each case gets ONLY its own shop's listing histories
  // (`presenceForCase`). A failed read = no presence (the reference outcome), never a crash.
  let presenceRead: Awaited<ReturnType<typeof loadPresenceForProducts>> | null = null
  if (readHistoricalExposureMode() !== "off") {
    const read = await loadPresenceForProducts(products).catch(() => null)
    if (read?.available && read.trackingStartedAt) presenceRead = read
  }
  const cases: ProposalCase[] = [...first.values()].map((r) => {
    const k = `${r.actorId}\u0000${r.entityId}`
    return {
      affiliateId: r.actorId!,
      productId: r.entityId!,
      shownAt: r.createdAt,
      snapshot: parseSnapshot(r.payload),
      listingCreatedAt: listingBy.get(k) ?? null,
      viaCopilot: addIds.has(copilotAddId(r.actorId!, r.entityId!)),
      orders: ordersBy.get(k) ?? [],
      presence: presenceRead?.trackingStartedAt
        ? { trackingStartedAt: presenceRead.trackingStartedAt, truncated: presenceRead.truncated, histories: presenceForCase(presenceRead.listings, r.actorId!, r.entityId!) }
        : null,
    }
  })
  return { cases, truncated }
}

/** Founder report (aggregates only), cached 6 h. null when the mode is off or the read failed. */
export async function loadCopilotLearningReport(now = new Date()): Promise<LearningReport | null> {
  if (readCopilotLearningMode() === "off") return null
  try {
    const bucket = now.toISOString().slice(0, 13)
    return await unstable_cache(
      async () => {
        const { cases, truncated } = await loadLearningCases(now)
        return buildLearningReport(cases, now, { truncated, exposureMode: readHistoricalExposureMode() })
      },
      ["copilot-learning-report-v2", bucket, readHistoricalExposureMode()],
      { revalidate: 6 * 3600 },
    )()
  } catch (error) {
    console.error("[copilot-learning] report_unreadable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

/** What resellers may be shown: the measured situations, only in mode `on`. */
export async function loadSituationTracksForResellers(): Promise<SituationTrack[] | null> {
  if (readCopilotLearningMode() !== "on") return null
  return (await loadCopilotLearningReport())?.situations ?? null
}

/** Retention: deletes snapshots / add markers older than `LEARNING_RETENTION_DAYS` — only with `apply: true` (not scheduled). */
export async function purgeExpiredCopilotLearning(opts: { apply: boolean; now?: Date }): Promise<{ expired: number; deleted: number }> {
  const now = opts.now ?? new Date()
  const limit = new Date(now.getTime() - LEARNING_RETENTION_DAYS * DAY)
  const rows = await prisma.auditLog.findMany({
    where: { action: { in: [PROPOSAL_ACTION, COPILOT_ADD_ACTION] }, createdAt: { lt: limit } },
    select: { id: true, createdAt: true },
    take: 50_000,
  })
  const ids = planLearningPurge(rows, now)
  if (!opts.apply || ids.length === 0) return { expired: ids.length, deleted: 0 }
  const r = await prisma.auditLog.deleteMany({ where: { id: { in: ids }, action: { in: [PROPOSAL_ACTION, COPILOT_ADD_ACTION] } } })
  return { expired: ids.length, deleted: r.count }
}

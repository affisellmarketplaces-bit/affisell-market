import "server-only"

import { unstable_cache } from "next/cache"

import { loadQualityEvidenceSafe } from "@/lib/commercial-readiness/readiness-context.server"
import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import {
  BLIND_SPOT_WINDOW_DAYS,
  buildBlindSpotReport,
  readBlindSpotsMode,
  type BlindSpotOrder,
  type BlindSpotProductInput,
  type BlindSpotReport,
} from "@/lib/reseller-copilot/blind-spots"
import { parseSnapshot, readCopilotLearningMode } from "@/lib/reseller-copilot/learning"
import { PROPOSAL_ACTION } from "@/lib/reseller-copilot/learning.server"
import { loadCandidates } from "@/lib/reseller-copilot/selection.server"
import { loadPresenceForProducts } from "@/lib/listing-presence/presence.server"
import type { PresenceHistory } from "@/lib/listing-presence/periods"

/**
 * READ-ONLY reads of the blind-spot detector (rules: blind-spots.ts). Marketplace-wide view of the copilot's candidates
 * (same visibility as the reseller catalogue, no shop filter), live listings, paid orders of the window, and — only
 * when the learning loop already records them — the real proposal snapshots. Writes nothing, changes no ranking.
 */
export const BLIND_SPOT_MAX_PRODUCTS = 5_000
export const BLIND_SPOT_MAX_LISTINGS = 100_000
export const BLIND_SPOT_MAX_ORDERS = 200_000
const DAY = 86_400_000

export async function loadBlindSpotInputs(now = new Date()): Promise<{ products: BlindSpotProductInput[]; truncated: boolean }> {
  const evidence = await loadQualityEvidenceSafe()
  const { candidates, truncated: candTruncated } = await loadCandidates(null, undefined, now, evidence, BLIND_SPOT_MAX_PRODUCTS)
  const ids = candidates.map((c) => c.productId)
  if (ids.length === 0) return { products: [], truncated: candTruncated }
  const since = new Date(now.getTime() - BLIND_SPOT_WINDOW_DAYS * DAY)
  const learning = readCopilotLearningMode() !== "off"
  // Presence history (migration 20261124090000): used ONLY when available and read in full — a capped read would
  // judge some products on part of their listings, so it falls back to live listings for everyone.
  const presenceRead = await loadPresenceForProducts(ids).catch(() => null)
  const presenceBy = new Map<string, Array<{ affiliateId: string; history: PresenceHistory }>>()
  // And only once the history covers the WHOLE window: before that, presence-based exposure would count only the
  // few days since the migration and turn almost every product into « données insuffisantes ».
  const historyCoversWindow = Boolean(presenceRead?.trackingStartedAt && presenceRead.trackingStartedAt.getTime() <= since.getTime())
  if (presenceRead?.available && !presenceRead.truncated && historyCoversWindow) {
    for (const l of presenceRead.listings) presenceBy.set(l.productId, [...(presenceBy.get(l.productId) ?? []), { affiliateId: l.affiliateId, history: l.history }])
  }
  const [listings, orders, proposals] = await Promise.all([
    prisma.affiliateProduct.findMany({
      where: { productId: { in: ids }, isListed: true },
      select: { affiliateId: true, productId: true, createdAt: true },
      take: BLIND_SPOT_MAX_LISTINGS + 1,
    }),
    prisma.order.findMany({
      where: { productId: { in: ids }, paidAt: { gte: since } },
      select: {
        affiliateId: true, productId: true, paidAt: true, quantity: true, status: true, paymentSettlementStatus: true,
        affiliatePayoutCents: true, affiliateMarginRetainedCents: true, affiliateFeeCents: true, affiliateMarginCents: true,
      },
      take: BLIND_SPOT_MAX_ORDERS + 1,
    }),
    learning
      ? prisma.auditLog.findMany({ where: { action: PROPOSAL_ACTION, createdAt: { gte: since } }, select: { entityId: true, payload: true }, take: 50_001 })
      : Promise.resolve([]),
  ])
  const truncated = candTruncated || listings.length > BLIND_SPOT_MAX_LISTINGS || orders.length > BLIND_SPOT_MAX_ORDERS || proposals.length > 50_000
  const listingsBy = new Map<string, Array<{ affiliateId: string; createdAt: Date }>>()
  for (const l of listings.slice(0, BLIND_SPOT_MAX_LISTINGS)) listingsBy.set(l.productId, [...(listingsBy.get(l.productId) ?? []), { affiliateId: l.affiliateId, createdAt: l.createdAt }])
  const ordersBy = new Map<string, BlindSpotOrder[]>()
  for (const o of orders.slice(0, BLIND_SPOT_MAX_ORDERS)) {
    if (!o.paidAt || !o.productId || !o.affiliateId) continue
    ordersBy.set(o.productId, [
      ...(ordersBy.get(o.productId) ?? []),
      {
        affiliateId: o.affiliateId,
        paidAt: o.paidAt,
        quantity: Math.max(1, o.quantity ?? 1),
        netCents: netAffiliateTransferCents({ affiliatePayoutCents: o.affiliatePayoutCents, affiliateMarginRetainedCents: o.affiliateMarginRetainedCents, affiliateFeeCents: o.affiliateFeeCents, affiliateMarginCents: o.affiliateMarginCents }),
        closed: isOrderClosedForPayout({ status: o.status, paymentSettlementStatus: o.paymentSettlementStatus }),
      },
    ])
  }
  const shownBy = new Map<string, { shown: number; rankSum: number }>()
  for (const r of proposals) {
    const s = r.entityId ? parseSnapshot(r.payload) : null
    if (!s || !r.entityId) continue
    const cur = shownBy.get(r.entityId) ?? { shown: 0, rankSum: 0 }
    shownBy.set(r.entityId, { shown: cur.shown + 1, rankSum: cur.rankSum + s.rank })
  }
  const products = candidates.map((c) => {
    const s = shownBy.get(c.productId)
    return {
      candidate: c,
      listings: listingsBy.get(c.productId) ?? [],
      orders: ordersBy.get(c.productId) ?? [],
      presence: presenceBy.get(c.productId) ?? null,
      // With the learning loop recording, « never shown » is an observed 0; without it, unknown (null).
      proposals: learning ? { shown: s?.shown ?? 0, meanRank: s ? Math.round((s.rankSum / s.shown) * 10) / 10 : 0 } : null,
    }
  })
  return { products, truncated }
}

/** Founder report (aggregates; a product named only from ≥ 3 shops), cached 6 h. null when off or unreadable. */
export async function loadCopilotBlindSpotReport(now = new Date()): Promise<BlindSpotReport | null> {
  if (readBlindSpotsMode() === "off") return null
  try {
    const bucket = now.toISOString().slice(0, 13)
    return await unstable_cache(
      async () => {
        const { products, truncated } = await loadBlindSpotInputs(now)
        return buildBlindSpotReport(products, now, { truncated })
      },
      ["copilot-blind-spots-v1", bucket],
      { revalidate: 6 * 3600 },
    )()
  } catch (error) {
    console.error("[copilot-blind-spots] report_unreadable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

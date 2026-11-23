import "server-only"

import { unstable_cache } from "next/cache"

import { loadQualityEvidenceSafe } from "@/lib/commercial-readiness/readiness-context.server"
import { loadPresenceForProducts } from "@/lib/listing-presence/presence.server"
import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import { notEligibleReasons, type BlindSpotOrder } from "@/lib/reseller-copilot/blind-spots"
import { rankGeneric } from "@/lib/reseller-copilot/selection"
import { loadCandidates } from "@/lib/reseller-copilot/selection.server"
import {
  buildTemporalReport,
  readTemporalMode,
  type TemporalListing,
  type TemporalProduct,
  type TemporalReport,
} from "@/lib/reseller-copilot/temporal-opportunities"

/**
 * READ-ONLY reads of the temporal opportunity engine (rules: temporal-opportunities.ts): the copilot's marketplace view
 * of the catalogue (names + today's eligibility with the blind-spot detector's own rule), the presence history of every
 * listing of those products (`loadPresenceForProducts`), and each shop's own paid orders since history began. Writes
 * nothing. History unavailable (migration not applied) = `available: false`, nothing computed.
 */
export const TEMPORAL_MAX_PRODUCTS = 5_000
export const TEMPORAL_MAX_ORDERS = 200_000

export async function loadTemporalInputs(now = new Date()): Promise<{ listings: TemporalListing[]; products: TemporalProduct[]; trackingStartedAt: Date | null; truncated: boolean }> {
  const evidence = await loadQualityEvidenceSafe()
  const { candidates, truncated: candTruncated } = await loadCandidates(null, undefined, now, evidence, TEMPORAL_MAX_PRODUCTS)
  const ids = candidates.map((c) => c.productId)
  const presence = await loadPresenceForProducts(ids)
  if (!presence.available || !presence.trackingStartedAt) return { listings: [], products: [], trackingStartedAt: null, truncated: false }
  const { ranked, blocked } = rankGeneric(candidates, null)
  const byId = new Map(candidates.map((c) => [c.productId, c]))
  const products: TemporalProduct[] = [...ranked, ...blocked].map((it) => ({
    productId: it.productId,
    name: it.name,
    eligibleToday: notEligibleReasons(it, byId.get(it.productId)!).length === 0,
  }))
  const orders = await prisma.order.findMany({
    where: { productId: { in: ids }, paidAt: { gte: presence.trackingStartedAt } },
    select: {
      affiliateId: true, productId: true, paidAt: true, quantity: true, status: true, paymentSettlementStatus: true,
      affiliatePayoutCents: true, affiliateMarginRetainedCents: true, affiliateFeeCents: true, affiliateMarginCents: true,
    },
    take: TEMPORAL_MAX_ORDERS + 1,
  })
  const ordersBy = new Map<string, BlindSpotOrder[]>()
  for (const o of orders.slice(0, TEMPORAL_MAX_ORDERS)) {
    if (!o.paidAt || !o.productId || !o.affiliateId) continue
    const k = `${o.productId}\u0000${o.affiliateId}`
    ordersBy.set(k, [
      ...(ordersBy.get(k) ?? []),
      {
        affiliateId: o.affiliateId,
        paidAt: o.paidAt,
        quantity: Math.max(1, o.quantity ?? 1),
        netCents: netAffiliateTransferCents({ affiliatePayoutCents: o.affiliatePayoutCents, affiliateMarginRetainedCents: o.affiliateMarginRetainedCents, affiliateFeeCents: o.affiliateFeeCents, affiliateMarginCents: o.affiliateMarginCents }),
        closed: isOrderClosedForPayout({ status: o.status, paymentSettlementStatus: o.paymentSettlementStatus }),
      },
    ])
  }
  const listings: TemporalListing[] = presence.listings.map((l) => ({
    productId: l.productId,
    affiliateId: l.affiliateId,
    history: l.history,
    orders: ordersBy.get(`${l.productId}\u0000${l.affiliateId}`) ?? [],
  }))
  return { listings, products, trackingStartedAt: presence.trackingStartedAt, truncated: candTruncated || presence.truncated || orders.length > TEMPORAL_MAX_ORDERS }
}

/** Founder report (aggregates; a product named only from ≥ 3 resellers), cached 6 h. null when off or unreadable. */
export async function loadTemporalReport(now = new Date()): Promise<TemporalReport | null> {
  if (readTemporalMode() === "off") return null
  try {
    const bucket = now.toISOString().slice(0, 13)
    return await unstable_cache(
      async () => {
        const { listings, products, trackingStartedAt, truncated } = await loadTemporalInputs(now)
        return buildTemporalReport(listings, products, now, { trackingStartedAt, truncated })
      },
      ["copilot-temporal-v1", bucket],
      { revalidate: 6 * 3600 },
    )()
  } catch (error) {
    console.error("[copilot-temporal] report_unreadable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

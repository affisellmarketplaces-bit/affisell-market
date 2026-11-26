import "server-only"

import { unstable_cache } from "next/cache"

import { loadPresenceForProducts } from "@/lib/listing-presence/presence.server"
import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import type { BlindSpotOrder } from "@/lib/reseller-copilot/blind-spots"
import { measurePeriods, type MeasuredPeriod } from "@/lib/reseller-copilot/temporal-opportunities"
import { loadTemporalInputs } from "@/lib/reseller-copilot/temporal-opportunities.server"

/**
 * Reference periods shared by the Smart Retention Advisor and the Observation Plan — ONE read of « how long did
 * comparable listings take to make their first sale », with the temporal engine's own rule (`measurePeriods`: periods
 * with known edges, orders of that shop while it was listed). Three tiers, never mixed: the SAME product in other shops,
 * other products of the same category, and the whole marketplace (general). Cached 6 h per product / category / general
 * (shared by every reseller); the asking reseller's own periods are removed AFTER, so a reseller is never compared with
 * itself. A capped or unavailable read gives no periods (never a partial reference). READ-ONLY.
 */
export const REFERENCE_MAX_CATEGORY_PRODUCTS = 300
export const REFERENCE_MAX_ORDERS = 50_000

export async function measuredPeriodsFor(productIds: readonly string[], now: Date): Promise<MeasuredPeriod[] | null> {
  if (productIds.length === 0) return []
  const presence = await loadPresenceForProducts(productIds)
  if (!presence.available || presence.truncated || !presence.trackingStartedAt) return null
  const orders = await prisma.order.findMany({
    where: { productId: { in: [...productIds] }, paidAt: { gte: presence.trackingStartedAt } },
    select: {
      affiliateId: true, productId: true, paidAt: true, quantity: true, status: true, paymentSettlementStatus: true,
      affiliatePayoutCents: true, affiliateMarginRetainedCents: true, affiliateFeeCents: true, affiliateMarginCents: true,
    },
    take: REFERENCE_MAX_ORDERS + 1,
  })
  if (orders.length > REFERENCE_MAX_ORDERS) return null
  const by = new Map<string, BlindSpotOrder[]>()
  for (const o of orders) {
    if (!o.paidAt || !o.productId || !o.affiliateId) continue
    const k = `${o.productId}\u0000${o.affiliateId}`
    by.set(k, [
      ...(by.get(k) ?? []),
      {
        affiliateId: o.affiliateId,
        paidAt: o.paidAt,
        quantity: Math.max(1, o.quantity ?? 1),
        netCents: netAffiliateTransferCents({ affiliatePayoutCents: o.affiliatePayoutCents, affiliateMarginRetainedCents: o.affiliateMarginRetainedCents, affiliateFeeCents: o.affiliateFeeCents, affiliateMarginCents: o.affiliateMarginCents }),
        closed: isOrderClosedForPayout({ status: o.status, paymentSettlementStatus: o.paymentSettlementStatus }),
      },
    ])
  }
  return presence.listings.flatMap(
    (l) => measurePeriods({ productId: l.productId, affiliateId: l.affiliateId, history: l.history, orders: by.get(`${l.productId}\u0000${l.affiliateId}`) ?? [] }, now).periods,
  )
}

function cachedPeriods(key: string, load: () => Promise<MeasuredPeriod[] | null>, now: Date) {
  const bucket = now.toISOString().slice(0, 13)
  return unstable_cache(load, ["observation-ref-v1", key, bucket], { revalidate: 6 * 3600 })()
}

async function generalPeriods(now: Date): Promise<MeasuredPeriod[] | null> {
  const { listings, trackingStartedAt, truncated } = await loadTemporalInputs(now)
  if (!trackingStartedAt || truncated) return null
  return listings.flatMap((l) => measurePeriods(l, now).periods)
}

export type ReferencePeriods = { productPeriods: MeasuredPeriod[]; categoryPeriods: MeasuredPeriod[]; generalPeriods: MeasuredPeriod[] }

export async function loadReferencePeriods(opts: {
  productId: string
  categoryId: string | null
  excludeAffiliateId: string
  /** Read the category only when the product reference is too thin (default: always). */
  needCategory?: (productPeriods: MeasuredPeriod[]) => boolean
  /** Read the whole marketplace only when asked (it is the heaviest read). */
  needGeneral?: (productPeriods: MeasuredPeriod[], categoryPeriods: MeasuredPeriod[]) => boolean
  now: Date
}): Promise<ReferencePeriods> {
  const { productId, categoryId, excludeAffiliateId, now } = opts
  const productPeriods = ((await cachedPeriods(`p:${productId}`, () => measuredPeriodsFor([productId], now), now)) ?? []).filter(
    (x) => x.affiliateId !== excludeAffiliateId,
  )
  let categoryPeriods: MeasuredPeriod[] = []
  if (categoryId && (opts.needCategory ? opts.needCategory(productPeriods) : true)) {
    const loaded = await cachedPeriods(
      `c:${categoryId}`,
      async () => {
        const ids = await prisma.product.findMany({ where: { categoryId }, select: { id: true }, orderBy: { createdAt: "desc" }, take: REFERENCE_MAX_CATEGORY_PRODUCTS })
        return measuredPeriodsFor(ids.map((r) => r.id), now)
      },
      now,
    )
    categoryPeriods = (loaded ?? []).filter((x) => x.affiliateId !== excludeAffiliateId && x.productId !== productId)
  }
  let general: MeasuredPeriod[] = []
  if (opts.needGeneral?.(productPeriods, categoryPeriods)) {
    general = ((await cachedPeriods("g", () => generalPeriods(now), now)) ?? []).filter((x) => x.affiliateId !== excludeAffiliateId && x.productId !== productId)
  }
  return { productPeriods, categoryPeriods, generalPeriods: general }
}

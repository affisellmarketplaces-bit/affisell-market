/**
 * « 5 acheteurs de votre boutique attendent Noir / M » — the reseller-facing demand signal, and what the reseller did
 * with it (founder brief 2026-11-20). Pure, client-safe types.
 *
 * Built from the SAME requests and the SAME counting rule as the supplier signal (`distinctWaitingByVariant`), with one
 * difference: the group is the reseller's LISTING (one listing per product per shop, unique `affiliateId, productId`),
 * never the product across shops. So:
 *  - a buyer counts once per shop, and only in the shops where he asked — another shop's requests are never read for
 *    this shop, so a reseller can not learn what the same buyer did elsewhere;
 *  - distinct buyers only, active, unexpired requests only, threshold 3 (below it: nothing said at all);
 *  - one count per EXACT variant; the variant must still be sold out (computed on read — no stale counter);
 *  - counts and the variant's own label only: no buyer, contact, order or history.
 * It is an indication of explicit demand, never a guaranteed sale.
 *
 * Recovery chain, never mixed: demand observed → recommendation shown to the reseller → alternatives PROPOSED (shown) →
 * alternative CHOSEN by the reseller (added to / already in its shop) → orders PAID of that alternative in that shop
 * after the choice (refunds / cancellations apart) → demands left without a solution. A shown alternative is never
 * counted as a chosen one, a chosen one never as a sale, and a sale after a choice is an ASSOCIATION — Affisell can not
 * tell whether the buyer came because of it. Affisell NEVER replaces the requested product: the reseller chooses to
 * offer an alternative; the buyer's request stays as it is and the buyer stays free to buy either.
 */
import { RESTOCK_DEMAND_MIN_BUYERS } from "@/lib/restock-watch/restock-demand"

export const RECOVERY_WINDOW_DAYS = 30
const DAY = 86_400_000

export type ShopDemandItem = {
  listingId: string
  productId: string
  productName: string
  variantKey: string
  variantLabel: string
  /** Distinct buyers OF THIS SHOP waiting (≥ 3). */
  buyers: number
}

export const SHOP_DEMAND_SHOWN_ACTION = "affiliate.shop_demand_shown"
export const SHOP_DEMAND_RECO_ACTION = "affiliate.shop_demand_recommended"
export const SHOP_DEMAND_CHOSEN_ACTION = "affiliate.shop_demand_alternative_chosen"

export function shopDemandShownId(listingId: string, keyHash: string, day: string): string {
  return `shop-demand-shown:${listingId}:${keyHash}:${day}`
}
export function shopDemandRecoId(listingId: string, keyHash: string): string {
  return `shop-demand-reco:${listingId}:${keyHash}`
}
export function shopDemandChosenId(listingId: string, keyHash: string, productId: string): string {
  return `shop-demand-chosen:${listingId}:${keyHash}:${productId}`
}

export type ShownMarker = { affiliateId: string; listingId: string; variantKey: string; alternatives: number; day: string }
export type ChosenMarker = { affiliateId: string; listingId: string; variantKey: string; productId: string; chosenAt: string; added: boolean }

export type RecoveryOrder = {
  id: string
  affiliateId: string | null
  productId: string
  paidAt: Date
  closed: boolean
  buyerUserId: string | null
}

export type ShopRecoverySummary = {
  /** Live demand signals now (≥ 3 distinct buyers, variant still sold out). */
  demandsNow: number
  /** Distinct (listing × variant) for which the reseller was shown the recommendation. */
  recommendationsShown: number
  /** Distinct (listing × variant) for which alternatives were shown, and how many alternatives at most. */
  proposalsShown: number
  alternativesShown: number
  /** Alternatives the reseller CHOSE (distinct listing × variant × product). */
  alternativesChosen: number
  /** Paid orders of a chosen alternative IN THE SAME SHOP within 30 days of the choice — distinct orders. */
  ordersAfterChoice: number
  refundedOrCancelledAfterChoice: number
  /** Of them, placed by buyers who were waiting in that shop (counted, never named). */
  byWaitingBuyers: number
  /** Live demands for which no alternative was chosen. */
  withoutSolution: number
}

const groupKey = (listingId: string, variantKey: string) => `${listingId}\u0000${variantKey}`

/** Aggregates the recovery chain. `waitingBuyers` = ids of buyers who asked, per listing × variant (never output). */
export function summarizeShopRecovery(args: {
  demands: ReadonlyArray<ShopDemandItem>
  recommended: ReadonlyArray<{ listingId: string; variantKey: string }>
  shown: ReadonlyArray<ShownMarker>
  chosen: ReadonlyArray<ChosenMarker>
  orders: ReadonlyArray<RecoveryOrder>
  waitingBuyers: ReadonlyMap<string, ReadonlySet<string>>
}): ShopRecoverySummary {
  const shownBy = new Map<string, number>()
  for (const s of args.shown) shownBy.set(groupKey(s.listingId, s.variantKey), Math.max(shownBy.get(groupKey(s.listingId, s.variantKey)) ?? 0, s.alternatives))
  const chosenGroups = new Set(args.chosen.map((c) => groupKey(c.listingId, c.variantKey)))
  const seenOrders = new Set<string>()
  let orders = 0
  let closed = 0
  let byWaiting = 0
  for (const c of args.chosen) {
    const from = Date.parse(c.chosenAt)
    const to = from + RECOVERY_WINDOW_DAYS * DAY
    const waiting = args.waitingBuyers.get(groupKey(c.listingId, c.variantKey))
    for (const o of args.orders) {
      if (o.affiliateId !== c.affiliateId || o.productId !== c.productId || seenOrders.has(o.id)) continue
      const t = o.paidAt.getTime()
      if (t < from || t > to) continue
      seenOrders.add(o.id) // an order counts once even if two choices could claim it
      orders++
      if (o.closed) closed++
      if (o.buyerUserId && waiting?.has(o.buyerUserId)) byWaiting++
    }
  }
  return {
    demandsNow: args.demands.filter((d) => d.buyers >= RESTOCK_DEMAND_MIN_BUYERS).length,
    recommendationsShown: new Set(args.recommended.map((r) => groupKey(r.listingId, r.variantKey))).size,
    proposalsShown: shownBy.size,
    alternativesShown: [...shownBy.values()].reduce((a, b) => a + b, 0),
    alternativesChosen: new Set(args.chosen.map((c) => `${groupKey(c.listingId, c.variantKey)}\u0000${c.productId}`)).size,
    ordersAfterChoice: orders,
    refundedOrCancelledAfterChoice: closed,
    byWaitingBuyers: byWaiting,
    withoutSolution: args.demands.filter((d) => !chosenGroups.has(groupKey(d.listingId, d.variantKey))).length,
  }
}

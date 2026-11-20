/**
 * From explicit buyer demand to a restock, and what followed — the measurement chain (founder brief 2026-11-20). Pure.
 *
 * ONE « demand episode » per exact variant (product × shared variant key): it OPENS when ≥ 3 distinct buyers wait for a
 * sold-out variant (the same threshold as the supplier signal), and follows six steps that are never mixed:
 *   1. demand            — OBSERVED: distinct buyers waiting (at opening, at peak, at return);
 *   2. recommendation    — RECOMMENDATION made available to the supplier (from opening) and, separately, the first time
 *                          the supplier's next-action card actually served it (`recommendationShownAt`);
 *   3. supplier action   — SUPPLIER ACTION: the product sheet modified after the demand opened (`sheetModifiedAt` — a
 *                          sheet date, NOT proof of a restock), the variant's quantity seen above 0 (`stockSeenAt`);
 *   4. return            — OBSERVED: the variant really buyable again (`backAt`: quantity > 0 AND the product sellable
 *                          for every other reason AND listed) — a quantity that changes while the product stays
 *                          unsellable is NOT a return; `unitsAtBack` < buyers waiting is flagged, never judged;
 *   5. notification      — real sends and theoretical ones (`observe`) counted apart, at read time;
 *   6. purchases         — COMMERCIAL RESULT: paid orders of that variant after the return, at read time, refunds and
 *                          cancellations counted apart — an ASSOCIATION, never « the recommendation caused the sale ».
 * An episode closes when the demand drops below the threshold before any return (expired / cancelled requests), when
 * the variant or every listing disappears, or 30 days after the return (follow-up window). Then a new demand opens a
 * new episode — a return followed by a new stock-out inside the window is recorded (`resoldOutAt`), not a new episode.
 * Nothing here reserves, decrements or invents a quantity: the stock read is the product's own figure.
 */
import { RESTOCK_DEMAND_MIN_BUYERS } from "@/lib/restock-watch/restock-demand"

export const DEMAND_FOLLOW_UP_DAYS = 30
const DAY = 86_400_000

export type DemandEpisodeStage = "waiting" | "back" | "closed"
export type DemandCloseReason = "demand_dropped" | "variant_removed" | "listing_removed" | "follow_up_done"

export type DemandEpisode = {
  productId: string
  variantKey: string
  variantLabel: string
  stage: DemandEpisodeStage
  openedAt: string
  buyersAtOpen: number
  peakBuyers: number
  recommendationShownAt: string | null
  sheetModifiedAt: string | null
  stockSeenAt: string | null
  backAt: string | null
  unitsAtBack: number | null
  buyersAtBack: number | null
  resoldOutAt: string | null
  closedAt: string | null
  closeReason: DemandCloseReason | null
  /** When the demand dropped: how many of the waiting requests had expired / been cancelled since the last look. */
  droppedBy: { expired: number; cancelled: number } | null
}

export type DemandObservation = {
  now: Date
  productId: string
  variantKey: string
  variantLabel: string
  /** Distinct buyers with an ACTIVE, unexpired request on this exact variant (whatever its stock). */
  waitingBuyers: number
  /** What the product says today about the variant. `unknown` = could not be read: nothing is concluded. */
  variant: { status: "found"; stock: number } | { status: "gone" } | { status: "ambiguous" } | { status: "unknown" }
  /** At least one listing of the product still exists / is live and visible to buyers. */
  listingExists: boolean
  listed: boolean
  /** Sellable for every other reason (`listingProblem` null, ignoring the stock of other variants). */
  sellable: boolean
  productUpdatedAt: Date | null
  /** Requests of this variant that became expired / cancelled (for the « demand dropped » reason). */
  lapsed: { expired: number; cancelled: number }
}

export type DemandTransition = { episode: DemandEpisode | null; event: "opened" | "updated" | "returned" | "closed" | "none" }

export function openDemandEpisodeId(productId: string, variantKeyHash: string, openedAt: Date): string {
  return `restock-demand-ep:${productId}:${variantKeyHash}:${openedAt.toISOString().slice(0, 10)}`
}

/** One step of the state machine. `prev` is the variant's episode that is still open (waiting / back), or null. */
export function nextDemandEpisode(prev: DemandEpisode | null, o: DemandObservation): DemandTransition {
  const now = o.now.toISOString()
  if (o.variant.status === "unknown") return { episode: prev, event: "none" } // a failed read never changes a state
  if (!prev || prev.stage === "closed") {
    if (o.waitingBuyers >= RESTOCK_DEMAND_MIN_BUYERS && o.variant.status === "found" && o.variant.stock === 0 && o.listingExists) {
      return {
        event: "opened",
        episode: {
          productId: o.productId,
          variantKey: o.variantKey,
          variantLabel: o.variantLabel,
          stage: "waiting",
          openedAt: now,
          buyersAtOpen: o.waitingBuyers,
          peakBuyers: o.waitingBuyers,
          recommendationShownAt: null,
          sheetModifiedAt: null,
          stockSeenAt: null,
          backAt: null,
          unitsAtBack: null,
          buyersAtBack: null,
          resoldOutAt: null,
          closedAt: null,
          closeReason: null,
          droppedBy: null,
        },
      }
    }
    return { episode: null, event: "none" }
  }
  const e: DemandEpisode = { ...prev }
  const close = (reason: DemandCloseReason): DemandTransition => ({
    event: "closed",
    episode: { ...e, stage: "closed", closedAt: now, closeReason: reason, droppedBy: reason === "demand_dropped" ? o.lapsed : e.droppedBy },
  })
  if (o.variant.status === "gone") return close("variant_removed")
  if (!o.listingExists) return close("listing_removed")
  if (o.productUpdatedAt && !e.sheetModifiedAt && o.productUpdatedAt.getTime() > Date.parse(e.openedAt)) e.sheetModifiedAt = o.productUpdatedAt.toISOString()

  if (e.stage === "waiting") {
    e.peakBuyers = Math.max(e.peakBuyers, o.waitingBuyers)
    if (o.variant.status === "found" && o.variant.stock > 0) {
      if (!e.stockSeenAt) e.stockSeenAt = now
      if (o.sellable && o.listed) {
        e.stage = "back"
        e.backAt = now
        e.unitsAtBack = o.variant.stock
        e.buyersAtBack = o.waitingBuyers
        return { event: "returned", episode: e }
      }
      return { event: "updated", episode: e } // quantity changed, but not buyable: not a return
    }
    if (o.waitingBuyers < RESTOCK_DEMAND_MIN_BUYERS) return close("demand_dropped")
    return { event: "updated", episode: e }
  }
  // back: follow-up window
  if (o.variant.status === "found" && o.variant.stock === 0 && !e.resoldOutAt) e.resoldOutAt = now
  if (e.backAt && o.now.getTime() - Date.parse(e.backAt) >= DEMAND_FOLLOW_UP_DAYS * DAY) return close("follow_up_done")
  return { event: "updated", episode: e }
}

export function parseDemandEpisode(raw: unknown): DemandEpisode | null {
  if (!raw || typeof raw !== "object") return null
  const p = raw as Partial<DemandEpisode>
  if (typeof p.productId !== "string" || typeof p.variantKey !== "string" || typeof p.openedAt !== "string") return null
  if (p.stage !== "waiting" && p.stage !== "back" && p.stage !== "closed") return null
  return p as DemandEpisode
}

/** Read-time outcome of one episode (purchases, notifications) — counts only. */
export type EpisodeOutcome = {
  /** Paid orders of THIS variant within 30 days of the return; `null` = can not be told (no return, or no reliable match). */
  ordersAfterReturn: number | null
  unitsAfterReturn: number | null
  /** Of them, later refunded or cancelled (kept, shown apart — never subtracted silently). */
  refundedOrCancelled: number | null
  /** Of them, placed by buyers who had asked to be told (counted, never named). */
  byWaitingBuyers: number | null
  notificationsSent: number
  notificationsTheoretical: number
}

export type OrderFact = { id: string; paidAt: Date; quantity: number; variantMatches: boolean | null; closed: boolean; buyerUserId: string | null }

/** Purchases after the return: distinct orders, matched to the variant, refunds kept apart. Association only. */
export function purchasesAfterReturn(
  episode: DemandEpisode,
  orders: ReadonlyArray<OrderFact>,
  waitingBuyerIds: ReadonlySet<string>
): Pick<EpisodeOutcome, "ordersAfterReturn" | "unitsAfterReturn" | "refundedOrCancelled" | "byWaitingBuyers"> {
  if (!episode.backAt) return { ordersAfterReturn: null, unitsAfterReturn: null, refundedOrCancelled: null, byWaitingBuyers: null }
  const from = Date.parse(episode.backAt)
  const to = from + DEMAND_FOLLOW_UP_DAYS * DAY
  const seen = new Set<string>()
  let orders_ = 0
  let units = 0
  let closed = 0
  let byWaiting = 0
  for (const o of orders) {
    const t = o.paidAt.getTime()
    if (t < from || t > to || seen.has(o.id)) continue
    if (o.variantMatches === null) return { ordersAfterReturn: null, unitsAfterReturn: null, refundedOrCancelled: null, byWaitingBuyers: null }
    if (!o.variantMatches) continue
    seen.add(o.id)
    orders_++
    units += Math.max(1, o.quantity)
    if (o.closed) closed++
    if (o.buyerUserId && waitingBuyerIds.has(o.buyerUserId)) byWaiting++
  }
  return { ordersAfterReturn: orders_, unitsAfterReturn: units, refundedOrCancelled: closed, byWaitingBuyers: byWaiting }
}

export type EpisodeView = Omit<DemandEpisode, "droppedBy"> & EpisodeOutcome & { daysToReturn: number | null; waitingDays: number }

export function episodeView(e: DemandEpisode, outcome: EpisodeOutcome, now: Date): EpisodeView {
  const { droppedBy: _d, ...rest } = e
  const opened = Date.parse(e.openedAt)
  const end = e.backAt ? Date.parse(e.backAt) : e.closedAt ? Date.parse(e.closedAt) : now.getTime()
  return {
    ...rest,
    ...outcome,
    daysToReturn: e.backAt ? Math.round((Date.parse(e.backAt) - opened) / DAY) : null,
    waitingDays: Math.max(0, Math.round((end - opened) / DAY)),
  }
}

/** Decision indicators over episodes — what the supplier (own products) or the founder (all) acts on. */
export type DemandFunnelSummary = {
  episodes: number
  waiting: number
  returned: number
  closedWithoutReturn: number
  returnRatePct: number | null
  medianDaysToReturn: number | null
  partialReturns: number
  resoldOutAfterReturn: number
  sheetModifiedNoReturn: number
  recommendationShown: number
  ordersAfterReturn: number
  refundedOrCancelledAfterReturn: number
  byWaitingBuyers: number
  /** Episodes whose purchases could not be matched to the variant (shown so the totals are read for what they are). */
  purchasesNotEvaluable: number
  notificationsSent: number
  notificationsTheoretical: number
  /** The most-demanded variants still waiting (peak distinct buyers), top 5. */
  topWaiting: Array<{ productId: string; variantLabel: string; peakBuyers: number; waitingDays: number }>
}

export function summarizeDemandFunnel(views: ReadonlyArray<EpisodeView>): DemandFunnelSummary {
  const returned = views.filter((v) => v.backAt)
  const finishedNoReturn = views.filter((v) => v.stage === "closed" && !v.backAt)
  const decided = returned.length + finishedNoReturn.length
  const delays = returned.map((v) => v.daysToReturn ?? 0).sort((a, b) => a - b)
  const median = delays.length ? (delays.length % 2 ? delays[(delays.length - 1) / 2]! : Math.round((delays[delays.length / 2 - 1]! + delays[delays.length / 2]!) / 2)) : null
  const sum = (f: (v: EpisodeView) => number | null) => views.reduce((s, v) => s + (f(v) ?? 0), 0)
  return {
    episodes: views.length,
    waiting: views.filter((v) => v.stage === "waiting").length,
    returned: returned.length,
    closedWithoutReturn: finishedNoReturn.length,
    returnRatePct: decided > 0 ? Math.round((returned.length / decided) * 100) : null,
    medianDaysToReturn: median,
    partialReturns: returned.filter((v) => (v.unitsAtBack ?? 0) < (v.buyersAtBack ?? 0)).length,
    resoldOutAfterReturn: returned.filter((v) => v.resoldOutAt).length,
    sheetModifiedNoReturn: views.filter((v) => !v.backAt && v.sheetModifiedAt).length,
    recommendationShown: views.filter((v) => v.recommendationShownAt).length,
    ordersAfterReturn: sum((v) => v.ordersAfterReturn),
    refundedOrCancelledAfterReturn: sum((v) => v.refundedOrCancelled),
    byWaitingBuyers: sum((v) => v.byWaitingBuyers),
    purchasesNotEvaluable: returned.filter((v) => v.ordersAfterReturn === null).length,
    notificationsSent: sum((v) => v.notificationsSent),
    notificationsTheoretical: sum((v) => v.notificationsTheoretical),
    topWaiting: views
      .filter((v) => v.stage === "waiting")
      .sort((a, b) => b.peakBuyers - a.peakBuyers || b.waitingDays - a.waitingDays)
      .slice(0, 5)
      .map((v) => ({ productId: v.productId, variantLabel: v.variantLabel, peakBuyers: v.peakBuyers, waitingDays: v.waitingDays })),
  }
}

/**
 * The reseller's ACTION PLAN — what to do today, in euros, with the reason — built from what is already measured:
 * listing health (net at their own price), supplier price alerts (marginReviewNeeded), demand momentum, cost drift,
 * traffic without sales, and the ranked opportunities. PURE: no I/O, deterministic, testable.
 *
 * Levels of autonomy (decided per action, never by the model):
 * - "recommend": information + a link (list a new product, review a supplier, look at a listing);
 * - "one_click": a prepared, REVERSIBLE change the reseller applies with one explicit click (reprice, pause) — applied
 *   server-side after recomputing the plan (a stale action is refused), recorded in AuditLog with before/after, undoable.
 * Nothing is ever applied automatically; nothing touches money already paid.
 *
 * Every euro figure is an ESTIMATE (`estimated: true`), never a guaranteed gain.
 */
import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import { evaluateMarginGuard, THIN_EXPECTED_NET_CENTS, THIN_EXPECTED_NET_RATE } from "@/lib/reseller-margin-guard"
import type { ListingHealthIssue } from "@/lib/reseller-opportunity-score"
import type { CostDrift, DemandMomentum } from "@/lib/reseller-signals"

/** A suggested price never raises the current one by more than this: beyond, the product needs a human decision. */
export const REPRICE_MAX_INCREASE = 0.25
const MAX_ACTIONS = 12

export type ActionType =
  | "reprice"
  | "pause"
  | "fix_margins"
  | "review_refunds"
  | "list_opportunity"
  | "push_momentum"
  | "review_traffic"
export type ActionAutonomy = "recommend" | "one_click"

export type ActionReason =
  | ListingHealthIssue
  | "supplier_price_changed"
  | "cost_drift_up"
  | "demand_rising"
  | "traffic_without_sales"
  | "top_opportunity"

export type PlannedAction = {
  /** Deterministic: `${type}:${target}` — the apply endpoint recomputes the plan and matches on it. */
  id: string
  type: ActionType
  autonomy: ActionAutonomy
  reversible: boolean
  listingId: string | null
  productId: string
  name: string
  reasons: ActionReason[]
  /** reprice only: price to set (cents). */
  suggestedPriceCents?: number
  currentPriceCents?: number
  /** Expected net per sale now / after the action (cents, after Affisell's fee and expected refunds). */
  expectedNetNowCents?: number
  expectedNetAfterCents?: number
  /** Ordering only: estimated euros at stake per sale (or score for opportunities). */
  impactCents: number
  estimated: true
}

export type PlanListingInput = {
  listingId: string
  productId: string
  name: string
  isListed: boolean
  sellingPriceCents: number
  supplierPriceCents: number
  commissionRatePct: number
  resellerFeeBps: number | null
  refundRate: number
  issues: ListingHealthIssue[]
  status: "ok" | "watch" | "action"
  expectedNetCents: number
  /** Per-variant prices set: a single new base price would not apply to every SKU → never one-click repriced. */
  hasVariantPricing: boolean
  marginReviewNeeded: boolean
  momentum?: DemandMomentum | null
  costDrift?: CostDrift | null
  traffic?: { flagged: boolean; clicks: number; conversionRate: number } | null
}

export type PlanOpportunityInput = {
  productId: string
  name: string
  riskAdjustedNetCents: number
  score: number
}

function expectedNetAt(l: PlanListingInput, priceCents: number) {
  const eco = buildAffiliateCatalogCardEconomics(l.supplierPriceCents, l.commissionRatePct, {
    listedSellingPriceCents: priceCents,
    resellerFeeBps: l.resellerFeeBps,
  })
  return evaluateMarginGuard({
    netGainCents: eco.netPartnerGainCents,
    clientPriceCents: priceCents,
    expectedRefundRate: l.refundRate,
  })
}

/**
 * Lowest whole-euro price (…,99 style not imposed) at which the listing's expected net becomes HEALTHY for the guard,
 * within +{@link REPRICE_MAX_INCREASE} of the current price. Null when already healthy or out of reach (then the
 * listing needs a human decision: pause, supplier, or accept a thin margin).
 * Monotonic search: the expected net grows with the selling price (markup), so a binary search on cents is exact.
 */
export function suggestHealthyPrice(l: PlanListingInput): number | null {
  if (expectedNetAt(l, l.sellingPriceCents).level === "healthy") return null
  // The bound is relative to what the buyer pays TODAY: a bigger jump is a business decision, not a one-click fix.
  const ceiling = Math.floor(l.sellingPriceCents * (1 + REPRICE_MAX_INCREASE))
  const floor = Math.max(l.sellingPriceCents, l.supplierPriceCents)
  if (floor > ceiling || expectedNetAt(l, ceiling).level !== "healthy") return null
  let lo = floor
  let hi = ceiling
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (expectedNetAt(l, mid).level === "healthy") hi = mid
    else lo = mid + 1
  }
  // Round UP to the next 10 cents: a readable price that stays healthy.
  const rounded = Math.ceil(lo / 10) * 10
  return rounded <= ceiling ? rounded : lo
}

export function buildActionPlan(args: {
  listings: readonly PlanListingInput[]
  opportunities?: readonly PlanOpportunityInput[]
}): PlannedAction[] {
  const actions: PlannedAction[] = []
  for (const l of args.listings) {
    if (!l.isListed) continue
    const base = { listingId: l.listingId, productId: l.productId, name: l.name, estimated: true as const }

    // 1. Supplier raised a price on a SKU → the existing margin auto-fix (variant-aware) is the right tool.
    if (l.marginReviewNeeded) {
      actions.push({
        ...base,
        id: `fix_margins:${l.listingId}`,
        type: "fix_margins",
        autonomy: "one_click",
        reversible: true,
        reasons: ["supplier_price_changed"],
        expectedNetNowCents: l.expectedNetCents,
        impactCents: Math.max(0, THIN_EXPECTED_NET_CENTS - l.expectedNetCents),
      })
      continue
    }

    const reasons: ActionReason[] = [...l.issues]
    if (l.costDrift?.drifted && l.costDrift.direction === "up") reasons.push("cost_drift_up")

    if (l.status === "action" || l.issues.includes("net_thin") || reasons.includes("cost_drift_up")) {
      const suggested = l.hasVariantPricing ? null : suggestHealthyPrice(l)
      if (suggested != null) {
        const after = expectedNetAt(l, suggested)
        actions.push({
          ...base,
          id: `reprice:${l.listingId}`,
          type: "reprice",
          autonomy: "one_click",
          reversible: true,
          reasons,
          currentPriceCents: l.sellingPriceCents,
          suggestedPriceCents: suggested,
          expectedNetNowCents: l.expectedNetCents,
          expectedNetAfterCents: after.expectedNetCents,
          impactCents: after.expectedNetCents - l.expectedNetCents,
        })
        continue
      }
      // Out of reach by price within +25 % and it does not earn → stop selling it (undoable).
      if (l.issues.includes("net_insufficient") || l.issues.includes("supplier_price_at_or_above_selling")) {
        actions.push({
          ...base,
          id: `pause:${l.listingId}`,
          type: "pause",
          autonomy: "one_click",
          reversible: true,
          reasons,
          currentPriceCents: l.sellingPriceCents,
          expectedNetNowCents: l.expectedNetCents,
          // Avoided loss per sale when the expected net is negative; otherwise a small priority.
          impactCents: Math.max(1, -l.expectedNetCents),
        })
        continue
      }
    }

    // Still earning, but refunds are climbing beyond chance: a human look (photos, description, supplier), not a pause.
    if (l.issues.includes("refund_rate_rising")) {
      actions.push({
        ...base,
        id: `review_refunds:${l.listingId}`,
        type: "review_refunds",
        autonomy: "recommend",
        reversible: true,
        reasons: ["refund_rate_rising"],
        expectedNetNowCents: l.expectedNetCents,
        impactCents: Math.max(1, l.expectedNetCents),
      })
      continue
    }

    if (l.traffic?.flagged) {
      actions.push({
        ...base,
        id: `review_traffic:${l.listingId}`,
        type: "review_traffic",
        autonomy: "recommend",
        reversible: true,
        reasons: ["traffic_without_sales"],
        expectedNetNowCents: l.expectedNetCents,
        impactCents: 1,
      })
    }

    if (l.momentum?.rising && l.status === "ok") {
      actions.push({
        ...base,
        id: `push_momentum:${l.listingId}`,
        type: "push_momentum",
        autonomy: "recommend",
        reversible: true,
        reasons: ["demand_rising"],
        expectedNetNowCents: l.expectedNetCents,
        impactCents: Math.max(0, l.expectedNetCents),
      })
    }
  }

  for (const o of (args.opportunities ?? []).slice(0, 3)) {
    actions.push({
      id: `list_opportunity:${o.productId}`,
      type: "list_opportunity",
      autonomy: "recommend",
      reversible: true,
      listingId: null,
      productId: o.productId,
      name: o.name,
      reasons: ["top_opportunity"],
      expectedNetAfterCents: o.riskAdjustedNetCents,
      impactCents: Math.max(0, o.riskAdjustedNetCents),
      estimated: true,
    })
  }

  const ORDER: Record<ActionType, number> = {
    fix_margins: 0,
    pause: 1,
    reprice: 2,
    review_refunds: 3,
    push_momentum: 4,
    list_opportunity: 5,
    review_traffic: 6,
  }
  return actions
    .sort((a, b) => ORDER[a.type] - ORDER[b.type] || b.impactCents - a.impactCents || a.id.localeCompare(b.id))
    .slice(0, MAX_ACTIONS)
}

/** Healthy thresholds, re-exported for the UI copy ("at least €X and Y % per sale"). */
export const HEALTHY_FLOOR = { cents: THIN_EXPECTED_NET_CENTS, rate: THIN_EXPECTED_NET_RATE }

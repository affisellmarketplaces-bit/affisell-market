/**
 * Supplier reliability index — PURE, explainable, fair to small suppliers.
 *
 * Built only from what Affisell records about each paid order (no opinion, no rating): late deliveries against the
 * delivery time the supplier promised, cancellations after payment, refunds and supplier price increases.
 * Stock-outs are NOT included: `Product.stock` defaults to 0 and is not used to hide products, so a 0 does not mean
 * "out of stock" today — counting it would penalise suppliers for a field they never filled. Every component is a
 * rate with:
 *
 * - **recency weighting** — an order counts `0.5^(age / half-life)`: what the supplier does now matters more;
 * - **shrinkage** towards the platform average (Beta prior worth {@link PRIOR_WEIGHT} orders), so 3 bad orders never
 *   sink a newcomer and 3 good ones never crown one;
 * - a **confidence** (effective weighted volume / (volume + prior)) and a minimum volume below which the index is
 *   reported but NOT used to penalise ({@link MIN_EFFECTIVE_ORDERS}).
 *
 * Index = 100 × Σ wᵢ (1 − rateᵢ) / Σ wᵢ, components weighted by commercial consequence for the reseller.
 */

export const HALF_LIFE_DAYS = 60
export const PRIOR_WEIGHT = 20
export const MIN_EFFECTIVE_ORDERS = 10

/** Relative weights: a refund or a cancellation costs the reseller more than a late parcel. */
export const COMPONENT_WEIGHTS = {
  late: 2,
  cancelled: 3,
  refunded: 3,
  priceIncrease: 1,
} as const
export type ReliabilityComponent = keyof typeof COMPONENT_WEIGHTS

export type SupplierOrderObservation = {
  paidAt: Date
  /** Delivered later than the supplier's promised maximum (null = not delivered yet / no promise → not counted). */
  late: boolean | null
  cancelled: boolean
  refunded: boolean
  /** Unit cost of this order above the previous order of the same SKU by ≥ 5 % (null = no previous order). */
  priceIncrease: boolean | null
}

export type PlatformBaseline = Record<ReliabilityComponent, number>

export type ComponentRate = { rate: number; observed: number; effective: number }

export type SupplierReliability = {
  /** 0–100, higher = more reliable. */
  index: number
  /** 0–1: share of the index carried by the supplier's own data. */
  confidence: number
  effectiveOrders: number
  /** True when there is enough data to use the index to rank or penalise. */
  usable: boolean
  components: Record<ReliabilityComponent, ComponentRate>
  /** Components clearly worse than the platform (for the explanation shown to resellers). */
  weakPoints: ReliabilityComponent[]
  estimated: true
}

const DAY = 86_400_000

export function recencyWeight(paidAt: Date, now: Date, halfLifeDays = HALF_LIFE_DAYS): number {
  const ageDays = Math.max(0, (now.getTime() - paidAt.getTime()) / DAY)
  return 0.5 ** (ageDays / halfLifeDays)
}

function shrunk(bad: number, total: number, prior: number): number {
  return (bad + PRIOR_WEIGHT * prior) / (total + PRIOR_WEIGHT)
}

export function computeSupplierReliability(args: {
  orders: readonly SupplierOrderObservation[]
  baseline: PlatformBaseline
  now?: Date
}): SupplierReliability {
  const now = args.now ?? new Date()
  const acc: Record<ReliabilityComponent, { bad: number; total: number; n: number }> = {
    late: { bad: 0, total: 0, n: 0 },
    cancelled: { bad: 0, total: 0, n: 0 },
    refunded: { bad: 0, total: 0, n: 0 },
    priceIncrease: { bad: 0, total: 0, n: 0 },
  }
  let effectiveOrders = 0
  for (const o of args.orders) {
    const w = recencyWeight(o.paidAt, now)
    effectiveOrders += w
    const add = (k: keyof typeof acc, v: boolean | null) => {
      if (v == null) return
      acc[k].total += w
      acc[k].n += 1
      if (v) acc[k].bad += w
    }
    add("late", o.late)
    add("cancelled", o.cancelled)
    add("refunded", o.refunded)
    add("priceIncrease", o.priceIncrease)
  }

  const components = {} as Record<ReliabilityComponent, ComponentRate>
  for (const k of Object.keys(acc) as Array<keyof typeof acc>) {
    components[k] = {
      rate: shrunk(acc[k].bad, acc[k].total, args.baseline[k]),
      observed: acc[k].n,
      effective: acc[k].total,
    }
  }
  let num = 0
  let den = 0
  for (const k of Object.keys(COMPONENT_WEIGHTS) as ReliabilityComponent[]) {
    num += COMPONENT_WEIGHTS[k] * (1 - components[k].rate)
    den += COMPONENT_WEIGHTS[k]
  }
  const weakPoints = (Object.keys(COMPONENT_WEIGHTS) as ReliabilityComponent[]).filter(
    (k) => components[k].observed >= 5 && components[k].rate > args.baseline[k] * 1.5 + 0.02,
  )
  return {
    index: Math.round((100 * num) / den),
    confidence: effectiveOrders / (effectiveOrders + PRIOR_WEIGHT),
    effectiveOrders,
    usable: effectiveOrders >= MIN_EFFECTIVE_ORDERS,
    components,
    weakPoints,
    estimated: true,
  }
}

/**
 * Multiplier for the opportunity score: 1 when unknown or not usable (never penalise without evidence), otherwise
 * the index relative to the platform's own index, clamped to [0.5, 1.2] so reliability reorders but never dominates.
 */
export function reliabilityMultiplier(r: SupplierReliability | null | undefined, platformIndex: number): number {
  if (!r || !r.usable || platformIndex <= 0) return 1
  return Math.min(1.2, Math.max(0.5, r.index / platformIndex))
}

/** The platform's own index (every component at its baseline) — the "average supplier". */
export function platformIndex(baseline: PlatformBaseline): number {
  let num = 0
  let den = 0
  for (const k of Object.keys(COMPONENT_WEIGHTS) as ReliabilityComponent[]) {
    num += COMPONENT_WEIGHTS[k] * (1 - baseline[k])
    den += COMPONENT_WEIGHTS[k]
  }
  return Math.round((100 * num) / den)
}

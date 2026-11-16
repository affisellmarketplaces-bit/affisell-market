import type { PeriodFigures } from "@/lib/intelligence/order-aggregates"

/**
 * Splits the change of a reseller's net earnings on ONE product between two periods into the drivers the order
 * snapshots can show — pure, integer cents, exact by construction (a residual carries what the model does not explain).
 *
 * Per unit, from the orders themselves (never from today's catalogue): S = HT price collected, W = supplier price,
 * c = supplier commission rate (commission / W), φ = Affisell's reseller fee share (fee / (transfer + fee)),
 * T = transfer to the reseller, R = share of T taken back by refunds. The settlement model is
 *   T = (c·W + (S − W)) · (1 − φ)        (commission + markup − Affisell's fee — lib/money/sale-split.ts)
 * and net = U · (T − R). Holding the other inputs at their previous value, one at a time:
 *   volume       (U1 − U0) · (T0 − R0)
 *   selling      U1 · (1 − φ0) · (S1 − S0)
 *   supplier     U1 · (1 − φ0) · (c0 − 1) · (W1 − W0)      (a higher supplier price eats the markup, lifts the commission)
 *   commission   U1 · (1 − φ0) · (c1 − c0) · W1
 *   fees         − U1 · (φ1 − φ0) · G1                       (G = T + F, gross before Affisell's fee)
 *   refunds      − U1 · (R1 − R0)
 *   residual     what is left (fixed listing margins, discounts, rounding) — reported, never attributed.
 * The sum of all terms equals net1 − net0 exactly.
 */
export type AttributionDriver = "volume" | "selling_price" | "supplier_price" | "commission" | "fees" | "refunds"

export type ProfitAttribution = {
  totalChangeCents: number
  effects: Record<AttributionDriver, number>
  residualCents: number
  /** Per-unit inputs of both periods, as observed in the orders (cents, rates in bps). */
  inputs: {
    previous: UnitInputs
    current: UnitInputs
  }
}

export type UnitInputs = {
  units: number
  sellingPerUnitCents: number
  supplierPerUnitCents: number
  commissionRateBps: number
  feeShareBps: number
  transferPerUnitCents: number
  reversedPerUnitCents: number
}

function unitInputs(p: PeriodFigures) {
  const u = p.units
  const per = (v: number) => (u > 0 ? v / u : 0)
  const W = per(p.supplierCents)
  const C = per(p.commissionCents)
  const T = per(p.payoutCents)
  const F = per(p.feeCents)
  const G = T + F
  return {
    u,
    S: per(p.sellingCents),
    W,
    c: W > 0 ? C / W : 0,
    phi: G > 0 ? F / G : 0,
    T,
    G,
    R: per(p.payoutReversedCents),
  }
}

function asInputs(x: ReturnType<typeof unitInputs>): UnitInputs {
  return {
    units: x.u,
    sellingPerUnitCents: Math.round(x.S),
    supplierPerUnitCents: Math.round(x.W),
    commissionRateBps: Math.round(x.c * 10_000),
    feeShareBps: Math.round(x.phi * 10_000),
    transferPerUnitCents: Math.round(x.T),
    reversedPerUnitCents: Math.round(x.R),
  }
}

export function attributeProfitChange(previous: PeriodFigures, current: PeriodFigures): ProfitAttribution {
  const p = unitInputs(previous)
  const c = unitInputs(current)
  const net0 = previous.payoutCents - previous.payoutReversedCents
  const net1 = current.payoutCents - current.payoutReversedCents
  const total = net1 - net0

  // Per-unit effects only make sense when both periods sold something.
  const both = p.u > 0 && c.u > 0
  const raw: Record<AttributionDriver, number> = {
    volume: (c.u - p.u) * (p.T - p.R),
    selling_price: both ? c.u * (1 - p.phi) * (c.S - p.S) : 0,
    supplier_price: both ? c.u * (1 - p.phi) * (p.c - 1) * (c.W - p.W) : 0,
    commission: both ? c.u * (1 - p.phi) * (c.c - p.c) * c.W : 0,
    fees: both ? -c.u * (c.phi - p.phi) * c.G : 0,
    refunds: both ? -c.u * (c.R - p.R) : 0,
  }
  const effects = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Math.round(v)])
  ) as Record<AttributionDriver, number>
  const explained = Object.values(effects).reduce((s, v) => s + v, 0)
  return {
    totalChangeCents: total,
    effects,
    residualCents: total - explained,
    inputs: { previous: asInputs(p), current: asInputs(c) },
  }
}

/** A driver is named as a cause only when it cost at least this share of the decline (and at least 1 €). */
export const CAUSE_MIN_SHARE_BPS = 1000
export const CAUSE_MIN_CENTS = 100
/** Above this share of the change, the residual is shown as "partly unexplained by the data". */
export const RESIDUAL_WARN_SHARE_BPS = 2500

export function significantNegativeDrivers(a: ProfitAttribution): AttributionDriver[] {
  const decline = Math.abs(Math.min(0, a.totalChangeCents))
  if (decline === 0) return []
  const floor = Math.max(CAUSE_MIN_CENTS, Math.round((decline * CAUSE_MIN_SHARE_BPS) / 10_000))
  return (Object.entries(a.effects) as Array<[AttributionDriver, number]>)
    .filter(([, v]) => v < 0 && -v >= floor)
    .sort((x, y) => x[1] - y[1])
    .map(([k]) => k)
}

export function residualIsLarge(a: ProfitAttribution): boolean {
  const total = Math.abs(a.totalChangeCents)
  return total > 0 && Math.abs(a.residualCents) * 10_000 > total * RESIDUAL_WARN_SHARE_BPS
}

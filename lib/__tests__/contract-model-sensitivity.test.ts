import { describe, expect, it } from "vitest"

import { DRAFT_CONTRACT_MODELS } from "@/lib/contract-models/drafts"
import { sweepUndecidedParameter, type SweepLine } from "@/lib/contract-models/sensitivity"

const byId = (id: string) => DRAFT_CONTRACT_MODELS.find((m) => m.id === id)!
const line = (o: Partial<SweepLine> = {}): SweepLine => ({
  orderId: "o1",
  priceHtCents: 10_000,
  wholesaleCents: 8_000,
  commissionBps: 1_000,
  sourceCostCents: 6_000,
  gridSupplierFeeBps: 1_000,
  estimatedStripeFeeCents: 400,
  ...o,
})

describe("sweeping an undecided rate", () => {
  it("C1: the procurement service fee moves money from supplier to Affisell, nothing else", () => {
    const r = sweepUndecidedParameter(byId("delegated-purchase"), "procurementServiceFeeBps", [line()], [0, 500, 1_000])
    expect(r.undecided).toBe(true)
    expect(r.rows.map((x) => x.value)).toEqual([0, 500, 1_000])
    const [a, b] = r.rows
    expect(b.affisellBeforeStripeCents - a.affisellBeforeStripeCents).toBe(300) // 5 % of the 6 000 source
    expect(a.supplierCents - b.supplierCents).toBe(300)
    expect(b.resellerCents).toBe(a.resellerCents)
  })

  it("B: reports where Affisell stops losing money and never picks a value", () => {
    const r = sweepUndecidedParameter(byId("platform-purchase"), "resellerFeeBps", [line({ sourceCostCents: 7_500 })])
    // B: Affisell = W − C + resellerFee − S − Stripe = 8 000 − 800 + fee − 7 500 − 400 → fee ≥ 700 cents needed;
    // fee = (C + M) × bps = 2 800 × bps → bps ≥ 2 500.
    expect(r.firstValueAffisellNonNegative).toBe(2_500)
    expect(r.firstValueNoLossLine).toBe(2_500)
    expect(r.disclaimer).toMatch(/pas une proposition/)
  })

  it("supplier shares turning negative are reported with the last safe value", () => {
    const r = sweepUndecidedParameter(byId("delegated-purchase"), "supplierFeeBps", [line()], [0, 4_000, 5_000])
    // W − C − fee − service(3 %·6 000 = 180) ≥ 0 → 7 200 − 8 000·bps − 180 ≥ 0 → bps ≤ 8 775 : all three are safe.
    expect(r.lastValueNoNegativeSupplier).toBe(5_000)
    const tight = sweepUndecidedParameter(byId("delegated-purchase"), "supplierFeeBps", [line({ commissionBps: 5_000 })], [0, 4_000, 5_000])
    // W − C = 4 000 → 4 000 − 8 000·bps − 180 ≥ 0 → bps ≤ 4 775.
    expect(tight.lastValueNoNegativeSupplier).toBe(4_000)
    expect(tight.rows.find((x) => x.value === 5_000)?.linesSupplierNegative).toBe(1)
  })

  it("an empty history gives no threshold, an out-of-range grid value is ignored", () => {
    const r = sweepUndecidedParameter(byId("advanced-purchase"), "procurementServiceFeeBps", [], [0, -5, 9_999, 100])
    expect(r.rows.map((x) => x.value)).toEqual([0, 100])
    expect(r.firstValueAffisellNonNegative).toBeNull()
  })
})

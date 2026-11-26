import { describe, expect, it } from "vitest"
import { DRAFT_CONTRACT_MODELS } from "@/lib/contract-models/drafts"
import { splitConserves, splitLine, validateContractModel, type ContractModel } from "@/lib/contract-models/model"
import { simulateModelOnOrders } from "@/lib/contract-models/simulate"
import { unitOutcome } from "@/lib/strategic-intelligence/lever-simulation"

const byPath = (path: ContractModel["path"]) => DRAFT_CONTRACT_MODELS.find((m) => m.path === path)!

const grid = (() => {
  const out: Array<{ P: number; W: number; c: number; S: number; fee: number }> = []
  for (const W of [500, 1999, 4500])
    for (const markup of [0, 300, 2500])
      for (const c of [0, 1000, 2500])
        for (const S of [0, 700, 3000])
          for (const fee of [0, 1000, 1700]) out.push({ P: W + markup, W, c, S, fee })
  return out
})()

describe("contract models — drafts are valid, roles are never inferred", () => {
  it("every draft passes the invariants (undecided values allowed only in draft)", () => {
    for (const m of DRAFT_CONTRACT_MODELS) expect(validateContractModel(m)).toEqual([])
  })

  it("a combination of roles outside the path's table is refused", () => {
    const a = byPath("A_catalogue")
    expect(validateContractModel({ ...a, roles: { ...a.roles, payer: "affisell" } })).toContain("role_not_allowed:payer")
  })

  it("an active model with undecided parameters is refused", () => {
    const b = byPath("B_platform_purchase")
    expect(validateContractModel({ ...b, status: "active" })).toContain("active_with_undecided_parameters")
  })

  it("C2 needs an advance with a guarantee and a cap; no other path may advance", () => {
    const c2 = byPath("C2_advanced_purchase")
    const p = c2.parameters
    expect(validateContractModel({ ...c2, parameters: { ...p, advance: { ...p.advance, guarantee: "none" } } })).toContain(
      "advance_without_guarantee"
    )
    const a = byPath("A_catalogue")
    expect(
      validateContractModel({ ...a, parameters: { ...a.parameters, advance: { allowed: true, maxCentsPerLine: 1, guarantee: "deposit" } } })
    ).toContain("advance_only_in_c2")
  })
})

describe("splitLine", () => {
  it("path A reproduces today's settlement split (unitOutcome) cent for cent", () => {
    const a = byPath("A_catalogue")
    for (const g of grid) {
      const s = splitLine(a, { priceHtCents: g.P, wholesaleCents: g.W, commissionBps: g.c, sourceCostCents: 0, gridSupplierFeeBps: g.fee })
      const u = unitOutcome({
        priceHtCents: g.P,
        wholesaleCents: g.W,
        commissionBps: g.c,
        supplierFeeBps: g.fee,
        affiliateFeeBps: 2000,
        vatRate: 0.2,
        aeCostCents: 0,
        refundShare: 0,
        defaulted: [],
      })
      expect(s.supplierTransferCents).toBe(u.supplierNetCents)
      expect(s.resellerTransferCents).toBe(u.resellerNetCents)
      expect(s.affisellNetBeforeStripeCents).toBe(u.affisellFeesCents)
    }
  })

  it("money is conserved on every path, and the source cost is paid once and deducted once", () => {
    for (const m of DRAFT_CONTRACT_MODELS) {
      for (const g of grid) {
        const S = m.path === "A_catalogue" ? 0 : g.S
        const line = { priceHtCents: g.P, wholesaleCents: g.W, commissionBps: g.c, sourceCostCents: S, gridSupplierFeeBps: g.fee }
        const s = splitLine(m, line)
        const shareBeforeSource = g.W - Math.round((g.W * g.c) / 10_000) - Math.round((g.W * (m.parameters.supplierFeeBps ?? g.fee)) / 10_000)
        if (shareBeforeSource >= 0 || m.path === "B_platform_purchase") expect(splitConserves(line, s)).toBe(true)
        expect(s.sourceCostDeductions).toBe(S > 0 ? 1 : 0)
        if (m.path === "B_platform_purchase") expect(s.supplierTransferCents).toBe(0)
        if (m.path === "A_catalogue" || m.path === "C1_delegated_purchase") expect(s.affisellPaysSourceCents).toBe(0)
      }
    }
  })

  it("C2: a supplier share smaller than the source leaves an exposure, never a negative transfer", () => {
    const c2 = byPath("C2_advanced_purchase")
    const s = splitLine(c2, { priceHtCents: 1000, wholesaleCents: 800, commissionBps: 2000, sourceCostCents: 900, gridSupplierFeeBps: 1000 })
    expect(s.supplierTransferCents).toBe(0)
    expect(s.uncoveredAdvanceCents).toBeGreaterThan(0)
  })
})

describe("simulation never changes an order", () => {
  it("reports actual vs simulated totals and labels undecided parameters", () => {
    const orders = [
      {
        orderId: "o1",
        priceHtCents: 2500,
        wholesaleCents: 2000,
        commissionBps: 1000,
        sourceCostCents: 900,
        gridSupplierFeeBps: 1000,
        actual: { supplierTransferCents: 1600, resellerTransferCents: 560, affisellFeesCents: 340 },
      },
    ]
    const r = simulateModelOnOrders(byPath("B_platform_purchase"), orders)
    expect(r.orders).toBe(1)
    expect(r.totals.supplier.simulated).toBe(0)
    expect(r.totals.affisellPaysSource).toBe(900)
    expect(r.disclaimer).toContain("non décidés")
    expect(orders[0]!.actual.supplierTransferCents).toBe(1600)
  })

  it("an invalid model simulates nothing", () => {
    const a = byPath("A_catalogue")
    const r = simulateModelOnOrders({ ...a, roles: { ...a.roles, payer: "affisell" } }, [])
    expect(r.invalidModel).toContain("role_not_allowed:payer")
    expect(r.orders).toBe(0)
  })
})

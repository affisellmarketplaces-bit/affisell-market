import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { sweepLinesFromOrders } from "@/lib/contract-models/history-lines"
import type { EconOrder } from "@/lib/strategic-intelligence/product-economics"

const order = (o: Partial<EconOrder["split"]> & { refundedCents?: number; disputed?: boolean } = {}): EconOrder =>
  ({
    orderId: "o",
    productId: "p",
    totalCents: 12_000,
    taxCents: 2_000,
    stripeFeesCents: 0,
    refundedCents: o.refundedCents ?? 0,
    taxReturnedCents: 0,
    disputed: o.disputed ?? false,
    split: {
      sellingPriceCents: 10_000,
      supplierPriceCents: 8_000,
      basePriceCents: 0,
      supplierCommissionRateBps: 1_000,
      supplierFeeCents: 0,
      usesAffisellAutoBuy: false,
      aeWholesaleCents: 0,
      ...o,
    },
    transfers: [],
  }) as unknown as EconOrder

const D = { catalogue: 1_000, autoBuy: 1_700 }

describe("past orders as contract-model lines", () => {
  it("only auto-buy orders with a recorded source cost feed paths B / C", () => {
    const r = sweepLinesFromOrders([order(), order({ usesAffisellAutoBuy: true, aeWholesaleCents: 6_000 }), order({ usesAffisellAutoBuy: true })], D)
    expect(r.catalogue).toHaveLength(3)
    expect(r.sourced).toHaveLength(1)
    expect(r.sourced[0].sourceCostCents).toBe(6_000)
    expect(r.catalogue.every((l) => l.sourceCostCents === 0)).toBe(true)
  })

  it("frozen fee rate first, else the settlement default of the line's channel; Stripe fee is the central estimate", () => {
    const [a, b, c] = sweepLinesFromOrders(
      [order({ supplierFeeCents: 400 }), order(), order({ usesAffisellAutoBuy: true, aeWholesaleCents: 1 })],
      D
    ).catalogue
    expect(a.gridSupplierFeeBps).toBe(500)
    expect(b.gridSupplierFeeBps).toBe(1_000)
    expect(c.gridSupplierFeeBps).toBe(1_700)
    expect(a.estimatedStripeFeeCents).toBe(Math.round(12_000 * 0.029 + 25))
  })

  it("refunded, disputed and price-less orders are counted out, never replayed", () => {
    const r = sweepLinesFromOrders(
      [order({ refundedCents: 100 }), order({ disputed: true }), order({ sellingPriceCents: 0 }), order({ supplierPriceCents: 0 })],
      D
    )
    expect(r.catalogue).toHaveLength(0)
    expect(r.excluded).toEqual({ noPrice: 1, noWholesale: 1, refundedOrDisputed: 2 })
  })

  it("the simulation route is admin-only and the runner never writes", () => {
    const root = path.resolve(__dirname, "../..")
    expect(readFileSync(path.join(root, "app/api/admin/contract-models/simulation/route.ts"), "utf8")).toContain("requireAdminSession()")
    const runner = readFileSync(path.join(root, "lib/contract-models/simulation.server.ts"), "utf8")
    expect(runner).not.toMatch(/\.(create|update|upsert|delete)(Many)?\(|\$executeRaw/)
  })
})

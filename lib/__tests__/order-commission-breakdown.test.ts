import { describe, expect, it } from "vitest"

import {
  buildOrderCommissionBreakdown,
  buildOrderCommissionView,
  isOrderCommissionRowVisible,
} from "@/lib/order-commission-breakdown"

const sampleOrder = {
  basePriceCents: 9508,
  supplierPriceCents: 9508,
  sellingPriceCents: 14832,
  subtotalCents: 14832,
  taxCents: 2966,
  totalCents: 17798,
  affiliatePayoutCents: 951,
  affiliateMarginRetainedCents: 4373,
  affiliateFeeCents: 200,
  supplierFeeCents: 951,
  affisellFeeCents: 1151,
  supplierPayoutCents: 7606,
  marginCents: 5324,
  usesAffisellAutoBuy: false,
  aeWholesaleCents: null,
  supplierCommissionRateBps: 1000,
}

describe("order-commission-breakdown visibility", () => {
  it("hides all client retail rows from suppliers", () => {
    const view = buildOrderCommissionView("SUPPLIER", sampleOrder)
    const labels = view.rows.map((r) => r.label)
    expect(labels).not.toContain("Prix client HT")
    expect(labels).not.toContain("TVA")
    expect(labels).not.toContain("Prix client TTC")
    expect(labels).not.toContain("Markup affilié")
    expect(labels).not.toContain("Gain affilié net")
  })

  it("shows wholesale-only rows to suppliers", () => {
    const view = buildOrderCommissionView("SUPPLIER", sampleOrder)
    const labels = view.rows.map((r) => r.label)
    expect(labels).toEqual([
      "Catalogue fournisseur (HT)",
      "Commission partenaire",
      "Frais plateforme Affisell (fournisseur)",
      "Net fournisseur",
    ])
  })

  it("shows client prices to affiliates", () => {
    const view = buildOrderCommissionView("AFFILIATE", sampleOrder)
    const labels = view.rows.map((r) => r.label)
    expect(labels).toContain("Prix client HT")
    expect(labels).toContain("Prix client TTC")
  })

  it("hides supplier catalog from affiliates by default", () => {
    const view = buildOrderCommissionView("AFFILIATE", sampleOrder, false)
    expect(view.rows.some((r) => r.key === "supplier_catalog")).toBe(false)
  })

  it("shows supplier catalog to affiliates when store allows revenue share", () => {
    const view = buildOrderCommissionView("AFFILIATE", sampleOrder, true)
    expect(view.rows.some((r) => r.key === "supplier_catalog")).toBe(true)
  })

  it("customer view is TTC-only lines", () => {
    const view = buildOrderCommissionView("CUSTOMER", sampleOrder)
    expect(view.rows.map((r) => r.key)).toEqual(["client_ht", "client_tax", "client_ttc"])
  })

  it("never exposes platform_fee_total in merchant views", () => {
    const breakdown = buildOrderCommissionBreakdown(sampleOrder)
    for (const role of ["SUPPLIER", "AFFILIATE", "CUSTOMER"] as const) {
      const view = buildOrderCommissionView(role, sampleOrder, true)
      expect(view.rows.some((r) => r.key === "platform_fee_total")).toBe(false)
    }
    expect(breakdown.rows.some((r) => r.key === "platform_fee_total")).toBe(true)
  })

  it("isOrderCommissionRowVisible blocks client rows for supplier", () => {
    expect(isOrderCommissionRowVisible("client_ht", "SUPPLIER", false)).toBe(false)
    expect(isOrderCommissionRowVisible("client_ttc", "SUPPLIER", false)).toBe(false)
    expect(isOrderCommissionRowVisible("supplier_net", "SUPPLIER", false)).toBe(true)
  })
})

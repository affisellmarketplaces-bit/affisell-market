import { describe, expect, it } from "vitest"

import {
  assertNoSupplierRetailLeak,
  collectSupplierRetailLeaks,
  supplierReturnLiabilityCents,
} from "@/lib/supplier-retail-veil"

describe("supplier-retail-veil", () => {
  it("computes wholesale clawback proportional to buyer refund", () => {
    const liability = supplierReturnLiabilityCents({
      order: {
        basePriceCents: 8000,
        supplierPriceCents: 8000,
        supplierPayoutCents: 6000,
        supplierCommissionRateBps: 1500,
        usesAffisellAutoBuy: false,
        supplierFeeCents: 800,
        aeWholesaleCents: null,
        affiliatePayoutCents: 1200,
      },
      buyerRefundCents: 10_000,
      buyerSellCents: 10_000,
    })
    expect(liability).toBe(6000)
  })

  it("scales liability on partial buyer refund without exposing retail", () => {
    const liability = supplierReturnLiabilityCents({
      order: {
        basePriceCents: 8000,
        supplierPriceCents: 8000,
        supplierPayoutCents: 6000,
        supplierCommissionRateBps: 1500,
        usesAffisellAutoBuy: false,
        supplierFeeCents: 800,
        aeWholesaleCents: null,
        affiliatePayoutCents: 1200,
      },
      buyerRefundCents: 5000,
      buyerSellCents: 10_000,
    })
    expect(liability).toBe(3000)
  })

  it("flags forbidden retail keys in supplier JSON trees", () => {
    const leaks = collectSupplierRetailLeaks({
      id: "ret_1",
      supplierLiabilityCents: 6000,
      order: { supplierNetCents: 6000, sellingPriceCents: 12_000 },
    })
    expect(leaks.some((l) => l.key === "sellingPriceCents")).toBe(true)
  })

  it("flags reseller boutique identity keys", () => {
    const leaks = collectSupplierRetailLeaks({
      partnerListingCode: "AFS-OK",
      boutiquePath: "/boutique/hidden",
    })
    expect(leaks.some((l) => l.key === "boutiquePath")).toBe(true)
  })

  it("accepts wholesale-only return payload shape", () => {
    const payload = [
      {
        id: "ret_1",
        status: "REQUESTED",
        supplierLiabilityCents: 6000,
        hasApprovedRefund: false,
        order: {
          id: "ord_1",
          supplierNetCents: 6000,
          quantity: 1,
          productName: "Widget",
        },
      },
    ]
    expect(() => assertNoSupplierRetailLeak(payload)).not.toThrow()
  })

  it("rejects buyer refund retail fields on supplier returns", () => {
    expect(() =>
      assertNoSupplierRetailLeak({
        requestedRefundCents: 12_000,
        approvedRefundCents: 12_000,
      })
    ).toThrow(/forbidden retail keys/)
  })

  it("accepts auto-buy pilot snapshot with supplierNetCents (not marginCents)", () => {
    const payload = {
      skus: [
        {
          productId: "p1",
          economics: { netMarginCents: 500, healthBand: "good" },
          realized: { orders: 2, revenueCents: 6000, supplierNetCents: 1200 },
        },
      ],
      summary: {
        totalSkus: 1,
        realizedOrders30d: 2,
        realizedSupplierNetCents30d: 1200,
      },
      radar: [],
      windowDays: 30,
    }
    expect(() => assertNoSupplierRetailLeak(payload)).not.toThrow()
  })

  it("rejects legacy marginCents on auto-buy pilot payloads", () => {
    expect(() =>
      assertNoSupplierRetailLeak({
        skus: [{ realized: { orders: 1, revenueCents: 100, marginCents: 50 } }],
      })
    ).toThrow(/forbidden retail keys/)
  })
})

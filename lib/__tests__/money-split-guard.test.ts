import { describe, expect, it } from "vitest"

import {
  attributeRefundToOrder,
  checkTransferBudget,
  isOrderFullyRefunded,
  moneyGuardMode,
  orderChargedTotalCents,
  orderLineHtCents,
  orderTransferCeilingCents,
  platformSubsidyCents,
  stableAffiliateCommissionCents,
} from "@/lib/money/split-guard"

describe("stableAffiliateCommissionCents", () => {
  it("derives from wholesale × bps, ignoring a corrupted payout field", () => {
    expect(
      stableAffiliateCommissionCents({
        supplierPriceCents: 9508,
        supplierCommissionRateBps: 1000,
        commissionCents: 0,
        affiliatePayoutCents: 5020,
      })
    ).toBe(951)
  })

  it("falls back to the stored commission, then only on first scheduling to the payout field", () => {
    const base = { basePriceCents: 1000, supplierCommissionRateBps: 0, commissionCents: 0, affiliatePayoutCents: 300 }
    expect(stableAffiliateCommissionCents({ ...base, commissionCents: 120 })).toBe(120)
    expect(stableAffiliateCommissionCents(base)).toBe(0)
    expect(stableAffiliateCommissionCents(base, { allowPayoutFieldFallback: true })).toBe(300)
  })
})

describe("orderChargedTotalCents", () => {
  it("restores HT + VAT when the total was overwritten with the HT line", () => {
    expect(
      orderChargedTotalCents({ totalCents: 14832, subtotalCents: 14832, taxCents: 2966, sellingPriceCents: 14832 })
    ).toBe(17798)
  })

  it("keeps a healthy total and a legitimate discount", () => {
    expect(orderChargedTotalCents({ totalCents: 1674, subtotalCents: 1395, taxCents: 279, sellingPriceCents: 1395 })).toBe(1674)
    expect(orderChargedTotalCents({ totalCents: 1500, subtotalCents: 1395, taxCents: 279, sellingPriceCents: 1395 })).toBe(1500)
  })

  it("has no VAT to restore on VAT-free orders", () => {
    expect(orderChargedTotalCents({ totalCents: 14560, subtotalCents: 14560, taxCents: 0, sellingPriceCents: 14560 })).toBe(14560)
  })
})

describe("checkTransferBudget", () => {
  it("passes exact and within-tolerance splits", () => {
    expect(checkTransferBudget({ lineHtCents: 1000, transferCents: [600, 400] }).ok).toBe(true)
    expect(checkTransferBudget({ lineHtCents: 1000, transferCents: [600, 402] }).ok).toBe(true)
  })

  it("blocks over-payment, counting transfers already paid", () => {
    const r = checkTransferBudget({ lineHtCents: 14832, transferCents: [9089], alreadyPaidCents: 7606 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.excessCents).toBe(1863)
  })

  it("never lets negative or NaN inputs mask an excess", () => {
    expect(checkTransferBudget({ lineHtCents: 100, transferCents: [-50, 200] }).ok).toBe(false)
  })
})

describe("orderLineHtCents / moneyGuardMode", () => {
  it("prefers subtotal over the selling price", () => {
    expect(orderLineHtCents({ subtotalCents: 900, sellingPriceCents: 1000 })).toBe(900)
    expect(orderLineHtCents({ subtotalCents: null, sellingPriceCents: 1000 })).toBe(1000)
  })

  it("enforces by default and only monitors on explicit opt-out", () => {
    expect(moneyGuardMode({})).toBe("enforce")
    expect(moneyGuardMode({ MONEY_GUARD_MODE: "monitor" })).toBe("monitor")
    expect(moneyGuardMode({ MONEY_GUARD_MODE: "off" })).toBe("enforce")
  })
})

describe("refund attribution on multi-order charges", () => {
  it("applies everything on a single-order charge", () => {
    expect(attributeRefundToOrder({ chargeOrderCount: 1, orderId: "a" })).toBe("apply")
  })

  it("only applies a refund to the order it names", () => {
    expect(attributeRefundToOrder({ chargeOrderCount: 2, orderId: "a", refundMetadataOrderId: "a" })).toBe("apply")
    expect(attributeRefundToOrder({ chargeOrderCount: 2, orderId: "b", refundMetadataOrderId: "a" })).toBe("other_order")
  })

  it("never guesses when a multi-order refund names no order", () => {
    expect(attributeRefundToOrder({ chargeOrderCount: 3, orderId: "a", refundMetadataOrderId: "" })).toBe("ambiguous")
  })

  it("does not let another order's refund mark this order fully refunded", () => {
    // Charge of 40€ = A 30€ + B 10€; A fully refunded (30€) → charge amount_refunded=3000.
    expect(
      isOrderFullyRefunded({ chargeOrderCount: 2, chargeAmountRefundedCents: 3000, orderRefundedSumCents: 0, orderChargedTotalCents: 1000 })
    ).toBe(false)
    expect(
      isOrderFullyRefunded({ chargeOrderCount: 1, chargeAmountRefundedCents: 1000, orderRefundedSumCents: 1000, orderChargedTotalCents: 1000 })
    ).toBe(true)
  })
})

describe("orderTransferCeilingCents / platformSubsidyCents", () => {
  it("uses the undiscounted price when the collected amount is lower (flash / store credit)", () => {
    expect(
      orderTransferCeilingCents({ subtotalCents: 5000, sellingPriceCents: 5000, supplierPriceCents: 7000, affiliateMarginCents: 3000 })
    ).toBe(10_000)
  })

  it("uses the collected amount when it is higher", () => {
    expect(orderTransferCeilingCents({ subtotalCents: 12_000, sellingPriceCents: 12_000, supplierPriceCents: 7000, affiliateMarginCents: 3000 })).toBe(12_000)
  })

  it("reports the platform-funded part of the payouts", () => {
    expect(platformSubsidyCents({ lineHtCents: 5000, payoutsCents: 8560 })).toBe(3560)
    expect(platformSubsidyCents({ lineHtCents: 10_000, payoutsCents: 8560 })).toBe(0)
  })
})

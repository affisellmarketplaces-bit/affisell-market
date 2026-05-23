import { describe, expect, it } from "vitest"

import {
  COMMISSION_RATE,
  calculateRefundSplit,
  calculateSplit,
} from "@/lib/commission"

describe("calculateSplit", () => {
  it("commission sur HT uniquement (produits + shipping, pas TVA)", () => {
    const split = calculateSplit({
      subtotalCents: 10_000,
      shippingCents: 0,
      taxCents: 2_000,
      stripeFeeCents: 373,
    })
    expect(split.commissionCents).toBe(1200)
    expect(split.commissionCents).toBe(Math.round(10_000 * COMMISSION_RATE))
    expect(split.totalCents).toBe(12_000)
    expect(split.sellerPayoutCents).toBe(10_427)
  })

  it("commission inclut shipping HT dans la base", () => {
    const split = calculateSplit({
      subtotalCents: 10_000,
      shippingCents: 500,
      taxCents: 2_100,
      stripeFeeCents: 400,
    })
    expect(split.commissionCents).toBe(Math.round(10_500 * COMMISSION_RATE))
    expect(split.totalCents).toBe(12_600)
  })

  it("throws when seller payout would be negative", () => {
    expect(() =>
      calculateSplit({
        subtotalCents: 10_000,
        shippingCents: 0,
        taxCents: 0,
        stripeFeeCents: 20_000,
      })
    ).toThrow("Seller payout negative")
  })
})

describe("calculateRefundSplit", () => {
  it("refund 50% retourne 50% com + 50% TVA", () => {
    const order = {
      totalCents: 12_000,
      commissionCents: 1200,
      taxCents: 2000,
    }
    const refund = calculateRefundSplit(order, 6000)
    expect(refund.commissionReturnedCents).toBe(600)
    expect(refund.taxReturnedCents).toBe(1000)
  })

  it("refund 100% retourne commission et TVA complètes", () => {
    const order = {
      totalCents: 12_000,
      commissionCents: 1200,
      taxCents: 2000,
    }
    const refund = calculateRefundSplit(order, 12_000)
    expect(refund.commissionReturnedCents).toBe(1200)
    expect(refund.taxReturnedCents).toBe(2000)
  })
})

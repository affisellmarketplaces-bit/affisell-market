import { describe, expect, it } from "vitest"

import {
  resolvedClawbackAmountCents,
  roleWasPaidOut,
} from "@/lib/payout-settlement"

type ClawbackOrder = NonNullable<Awaited<ReturnType<typeof import("@/lib/payout-settlement").loadOrderClawbackContext>>>

function mockOrder(overrides: Partial<ClawbackOrder> = {}): ClawbackOrder {
  return {
    id: "ord_1",
    supplierId: "sup_1",
    affiliateId: "aff_1",
    supplierPayoutAt: null,
    affiliatePayoutAt: null,
    supplierPayoutCents: 5000,
    affiliatePayoutCents: 1200,
    affiliateMarginRetainedCents: 800,
    affiliateFeeCents: 200,
    affiliateMarginCents: 1000,
    basePriceCents: 5000,
    supplierPriceCents: 5000,
    supplierCommissionRateBps: 1500,
    supplierFeeCents: 500,
    usesAffisellAutoBuy: false,
    aeWholesaleCents: null,
    payoutStatus: "PENDING",
    transferAttempts: [],
    merchantPayoutLedger: [],
    product: { name: "Test product" },
    ...overrides,
  }
}

describe("payout-settlement clawback helpers", () => {
  it("roleWasPaidOut is true when TransferAttempt SUCCESS exists", () => {
    const order = mockOrder({
      transferAttempts: [
        { role: "SUPPLIER", amountCents: 4500, stripeTransferId: "tr_sup" },
      ],
    })
    expect(roleWasPaidOut("SUPPLIER", order)).toBe(true)
    expect(roleWasPaidOut("AFFILIATE", order)).toBe(false)
  })

  it("roleWasPaidOut is true for legacy ledger without stripe", () => {
    const order = mockOrder({
      merchantPayoutLedger: [
        {
          beneficiaryRole: "AFFILIATE",
          amountCents: 1800,
          stripeTransferId: null,
          idempotencyKey: "payout:affiliate:ord_1",
        },
      ],
    })
    expect(roleWasPaidOut("AFFILIATE", order)).toBe(true)
  })

  it("resolvedClawbackAmountCents prefers TransferAttempt amount", () => {
    const order = mockOrder({
      supplierPayoutCents: 9999,
      transferAttempts: [
        { role: "SUPPLIER", amountCents: 4200, stripeTransferId: "tr_1" },
      ],
    })
    expect(resolvedClawbackAmountCents("SUPPLIER", order)).toBe(4200)
  })

  it("resolvedClawbackAmountCents uses stripe-linked ledger when no attempt", () => {
    const order = mockOrder({
      merchantPayoutLedger: [
        {
          beneficiaryRole: "AFFILIATE",
          amountCents: 1750,
          stripeTransferId: "tr_aff",
          idempotencyKey: "stripe:tr:tr_aff",
        },
      ],
    })
    expect(resolvedClawbackAmountCents("AFFILIATE", order)).toBe(1750)
  })
})

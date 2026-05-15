import { describe, expect, it } from "vitest"

import {
  AUTO_CONFIRM_DAYS_AFTER_DELIVERY,
  addDays,
  isReadyForMerchantPayout,
  payoutEligibleAfterBuyerConfirm,
  shouldAutoConfirmDelivery,
} from "@/lib/order-payout-policy"

describe("order payout policy", () => {
  it("buyer confirm schedules payout 7 days later", () => {
    const confirmed = new Date("2026-01-10T12:00:00Z")
    const eligible = payoutEligibleAfterBuyerConfirm(confirmed)
    expect(eligible.getTime()).toBe(addDays(confirmed, 7).getTime())
  })

  it("auto-confirms after 10 days without buyer action", () => {
    const delivered = new Date("2026-01-01T12:00:00Z")
    expect(AUTO_CONFIRM_DAYS_AFTER_DELIVERY).toBe(10)
    expect(shouldAutoConfirmDelivery({ deliveredAt: delivered, shippedAt: delivered, deliveryConfirmedAt: null }, addDays(delivered, 10))).toBe(true)
    expect(shouldAutoConfirmDelivery({ deliveredAt: delivered, shippedAt: delivered, deliveryConfirmedAt: null }, addDays(delivered, 9))).toBe(false)
  })

  it("blocks payout when return is open", () => {
    const delivered = new Date("2026-01-01T12:00:00Z")
    const confirmed = addDays(delivered, 10)
    expect(
      isReadyForMerchantPayout(
        {
          status: "shipped",
          deliveredAt: delivered,
          shippedAt: delivered,
          deliveryConfirmedAt: confirmed,
          deliveryConfirmedBy: "buyer",
          payoutEligibleAt: payoutEligibleAfterBuyerConfirm(confirmed),
          supplierPayoutAt: null,
          affiliatePayoutAt: null,
        },
        [{ status: "REQUESTED" }],
        payoutEligibleAfterBuyerConfirm(confirmed)
      )
    ).toBe(false)
  })
})

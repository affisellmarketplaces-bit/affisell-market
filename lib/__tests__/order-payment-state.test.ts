import { describe, expect, it } from "vitest"

import {
  isOrderClosedForPayout,
  settlementAfterSchedule,
  settlementAfterTransfersSucceeded,
  statusAfterPaymentConfirmed,
} from "@/lib/orders/payment-state"

describe("isOrderClosedForPayout", () => {
  it.each(["refunded", "REFUNDED", "Refunded", "cancelled", "CANCELLED", "canceled", " refunded "])(
    "treats status %s as closed",
    (status) => {
      expect(isOrderClosedForPayout({ status })).toBe(true)
    }
  )

  it.each(["REFUNDED", "refunded", "REFUND_PENDING_CLAWBACK", "CANCELLED"])(
    "treats settlement %s as closed even when the status still says paid",
    (paymentSettlementStatus) => {
      expect(isOrderClosedForPayout({ status: "paid", paymentSettlementStatus })).toBe(true)
    }
  )

  it.each(["paid", "PENDING", "pending", "preparing", "shipped", "delivered", "awaiting_manual_payment", "", null, undefined])(
    "does not close an order whose status is %s",
    (status) => {
      expect(isOrderClosedForPayout({ status, paymentSettlementStatus: "PAID" })).toBe(false)
    }
  )

  it("a partial refund does not close the order (remaining payouts are still due)", () => {
    expect(isOrderClosedForPayout({ status: "paid", paymentSettlementStatus: "PARTIALLY_REFUNDED" })).toBe(false)
  })
})

describe("statusAfterPaymentConfirmed", () => {
  it.each(["PENDING", "pending", "paid", "awaiting_manual_payment", "failed", "expired", "", null, undefined])(
    "%s becomes paid",
    (status) => {
      expect(statusAfterPaymentConfirmed(status)).toBe("paid")
    }
  )

  it.each(["preparing", "shipped", "SHIPPED", "delivered", "completed", "returned", "disputed"])(
    "keeps %s (already past paid)",
    (status) => {
      expect(statusAfterPaymentConfirmed(status)).toBe(status)
    }
  )
})

describe("settlementAfterSchedule", () => {
  it.each([null, undefined, "", "PENDING", "PAID", "FAILED"])("%s becomes PAID", (current) => {
    expect(settlementAfterSchedule(current)).toBe("PAID")
  })

  it.each(["SETTLED", "PARTIALLY_REFUNDED", "REFUNDED", "REFUND_PENDING_CLAWBACK", "CANCELLED"])(
    "never resets %s back to PAID",
    (current) => {
      expect(settlementAfterSchedule(current)).toBe(current)
    }
  )
})

describe("settlementAfterTransfersSucceeded", () => {
  it.each([null, undefined, "", "PENDING", "PAID"])("%s becomes SETTLED", (current) => {
    expect(settlementAfterTransfersSucceeded(current)).toBe("SETTLED")
  })

  it.each(["REFUNDED", "REFUND_PENDING_CLAWBACK", "PARTIALLY_REFUNDED", "CANCELLED"])(
    "never overwrites %s with SETTLED",
    (current) => {
      expect(settlementAfterTransfersSucceeded(current)).toBe(current)
    }
  )
})

import { describe, expect, it } from "vitest"

import {
  isOrderClosedForPayout,
  isOrderDisputed,
  isOrderPayoutHeldForDispute,
  orderAwaitsCheckoutFulfilment,
  orderIsFulfilledForCheckout,
  settlementAfterSchedule,
  settlementAfterTransfersSucceeded,
  statusAfterPaymentConfirmed,
  statusBeforeDispute,
  statusWhenDisputeOpens,
  statusWhenDisputeReleased,
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

  it.each(["preparing", "fulfilling", "shipped", "SHIPPED", "delivered", "completed", "returned", "disputed"])(
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

// Finalisation master doc, D7 — disputes (chargebacks).
describe("dispute order state", () => {
  it.each(["disputed", "DISPUTED", " Disputed "])("%s is a disputed order", (status) => {
    expect(isOrderDisputed({ status })).toBe(true)
  })

  it.each(["paid", "shipped", "refunded", "", null, undefined])("%s is not a disputed order", (status) => {
    expect(isOrderDisputed({ status })).toBe(false)
  })

  it("a dispute is not a refund: a disputed order is not 'closed' (its pending transfers are kept for a possible win)", () => {
    expect(isOrderClosedForPayout({ status: "disputed", paymentSettlementStatus: "PAID" })).toBe(false)
  })

  it("payout is held for an open dispute in the ledger even when the status was overwritten, or for the status alone", () => {
    expect(isOrderPayoutHeldForDispute({ status: "shipped" }, true)).toBe(true)
    expect(isOrderPayoutHeldForDispute({ status: "disputed" }, false)).toBe(true)
    expect(isOrderPayoutHeldForDispute({ status: "shipped" }, false)).toBe(false)
  })

  describe("statusWhenDisputeOpens", () => {
    it.each(["paid", "preparing", "shipped", "SHIPPED", "delivered", "completed", "returned"])(
      "%s becomes disputed",
      (status) => {
        expect(statusWhenDisputeOpens({ status, paymentSettlementStatus: "PAID" })).toBe("disputed")
      }
    )

    it("never reopens a refunded / cancelled order, and does not rewrite a disputed one", () => {
      expect(statusWhenDisputeOpens({ status: "refunded" })).toBeNull()
      expect(statusWhenDisputeOpens({ status: "cancelled" })).toBeNull()
      expect(statusWhenDisputeOpens({ status: "paid", paymentSettlementStatus: "REFUNDED" })).toBeNull()
      expect(statusWhenDisputeOpens({ status: "paid", paymentSettlementStatus: "REFUND_PENDING_CLAWBACK" })).toBeNull()
      expect(statusWhenDisputeOpens({ status: "disputed" })).toBeNull()
    })
  })

  describe("statusBeforeDispute (rebuilt from the order's own facts)", () => {
    it("shipped when shipped or tracked, preparing when the supplier started, paid otherwise", () => {
      expect(statusBeforeDispute({ shippedAt: new Date() })).toBe("shipped")
      expect(statusBeforeDispute({ trackingNumber: "TRK1" })).toBe("shipped")
      expect(statusBeforeDispute({ trackingNumber: "  " })).toBe("paid")
      expect(statusBeforeDispute({ supplierPreparingAt: new Date() })).toBe("preparing")
      expect(statusBeforeDispute({})).toBe("paid")
    })
  })

  describe("statusWhenDisputeReleased", () => {
    it("restores the EXACT status the ledger remembered", () => {
      expect(statusWhenDisputeReleased({ status: "disputed", shippedAt: new Date() }, "delivered")).toBe("delivered")
      expect(statusWhenDisputeReleased({ status: "disputed" }, "preparing")).toBe("preparing")
    })

    it("falls back to the order's facts when the ledger kept nothing usable", () => {
      expect(statusWhenDisputeReleased({ status: "disputed", shippedAt: new Date() }, null)).toBe("shipped")
      expect(statusWhenDisputeReleased({ status: "disputed" }, "  ")).toBe("paid")
      // a remembered status that is itself closed / disputed must never be restored
      expect(statusWhenDisputeReleased({ status: "disputed", shippedAt: new Date() }, "refunded")).toBe("shipped")
      expect(statusWhenDisputeReleased({ status: "disputed" }, "disputed")).toBe("paid")
    })

    it("never restores a status BEHIND the order's own facts (review #8): a stale 'paid' on a tracked order is 'shipped'", () => {
      expect(statusWhenDisputeReleased({ status: "disputed", shippedAt: new Date() }, "paid")).toBe("shipped")
      expect(statusWhenDisputeReleased({ status: "disputed", trackingNumber: "TRK1" }, "preparing")).toBe("shipped")
      expect(statusWhenDisputeReleased({ status: "disputed", supplierPreparingAt: new Date() }, "paid")).toBe("preparing")
      // but a remembered status AHEAD of the facts wins
      expect(statusWhenDisputeReleased({ status: "disputed", shippedAt: new Date() }, "delivered")).toBe("delivered")
      expect(statusWhenDisputeReleased({ status: "disputed", shippedAt: new Date() }, "SHIPPED")).toBe("SHIPPED")
    })

    it("an unknown remembered status never beats the facts (an order that was disputed was paid, so 'paid' is the floor)", () => {
      expect(statusWhenDisputeReleased({ status: "disputed", shippedAt: new Date() }, "weird_status")).toBe("shipped")
      expect(statusWhenDisputeReleased({ status: "disputed" }, "weird_status")).toBe("paid")
    })

    it.each(["disputed", "Disputed", "DISPUTED", " disputed "])("an order whose status is %j (any casing) is restored", (status) => {
      expect(statusWhenDisputeReleased({ status }, "preparing")).toBe("preparing")
    })

    it("leaves an order alone when it is no longer disputed (another writer moved it, or it was refunded)", () => {
      expect(statusWhenDisputeReleased({ status: "shipped" }, "paid")).toBeNull()
      expect(statusWhenDisputeReleased({ status: "refunded" }, "shipped")).toBeNull()
    })
  })
})

// Finalisation review #31 / #9: every status the code base writes on `Order.status`, against each rule.
// Writers found by a search over the Order writers: PENDING (checkout pre-create), paid, preparing, fulfilling (AliExpress
// paths), shipped, refunded, CANCELLED / cancelled, disputed (D7); delivered / completed / returned are only read.
describe("every Order.status the code base writes, against each rule", () => {
  const PRE_PAYMENT = ["PENDING", "pending", "", "failed", "expired", "awaiting_manual_payment", "pending_payment"]
  const AT_OR_PAST_PAID = ["paid", "preparing", "fulfilling", "shipped", "delivered", "completed", "returned", "disputed"]
  const CLOSED = ["refunded", "cancelled", "CANCELLED", "canceled", "REFUNDED"]

  it.each(PRE_PAYMENT)("pre-payment %s: becomes paid, awaits the checkout fulfilment, is not fulfilled", (status) => {
    expect(statusAfterPaymentConfirmed(status)).toBe("paid")
    expect(orderAwaitsCheckoutFulfilment({ status })).toBe(true)
    expect(orderIsFulfilledForCheckout({ status })).toBe(false)
  })

  it.each(AT_OR_PAST_PAID)("%s: kept by a payment confirmation, never re-enters the checkout fulfilment", (status) => {
    expect(statusAfterPaymentConfirmed(status)).toBe(status)
    // "paid" is the value written, so any casing of it comes out as "paid"; the later statuses keep their own casing
    expect(statusAfterPaymentConfirmed(status.toUpperCase())).toBe(status === "paid" ? "paid" : status.toUpperCase())
    expect(orderAwaitsCheckoutFulfilment({ status })).toBe(false)
    expect(orderAwaitsCheckoutFulfilment({ status: status.toUpperCase() })).toBe(false)
    expect(orderIsFulfilledForCheckout({ status })).toBe(true)
  })

  it.each(CLOSED)("closed %s: never reopened as paid, never re-enters the checkout fulfilment, is not 'fulfilled'", (status) => {
    expect(statusAfterPaymentConfirmed(status)).toBe(status)
    expect(orderAwaitsCheckoutFulfilment({ status })).toBe(false)
    expect(orderIsFulfilledForCheckout({ status })).toBe(false)
    expect(isOrderClosedForPayout({ status })).toBe(true)
  })

  it("fulfilling is what the AliExpress purchase paths write: a re-run of the scheduler can no longer send it back to paid", () => {
    expect(statusAfterPaymentConfirmed("fulfilling")).toBe("fulfilling")
    expect(statusAfterPaymentConfirmed(" fulfilling ")).toBe("fulfilling")
  })

  it("a pre-payment order already closed by its settlement does not await the fulfilment either", () => {
    expect(orderAwaitsCheckoutFulfilment({ status: "PENDING", paymentSettlementStatus: "CANCELLED" })).toBe(false)
    expect(orderAwaitsCheckoutFulfilment({ status: "PENDING", paymentSettlementStatus: "PENDING" })).toBe(true)
  })

  it("a cancelled booking never confirmed still awaits the fulfilment (a late payment recovers it); a confirmed one does not", () => {
    expect(orderAwaitsCheckoutFulfilment({ status: "CANCELLED", bookingSlotId: "slot_1", bookingConfirmedAt: null })).toBe(true)
    expect(orderAwaitsCheckoutFulfilment({ status: "cancelled", bookingSlotId: "slot_1", bookingConfirmedAt: null })).toBe(true)
    expect(orderAwaitsCheckoutFulfilment({ status: "CANCELLED", bookingSlotId: "slot_1", bookingConfirmedAt: new Date() })).toBe(false)
    expect(orderAwaitsCheckoutFulfilment({ status: "CANCELLED", bookingSlotId: null, bookingConfirmedAt: null })).toBe(false)
  })
})

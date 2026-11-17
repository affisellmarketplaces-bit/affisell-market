import { describe, expect, it } from "vitest"

import { refundSentenceKey, shouldKeepVerifying, successOutcome } from "@/lib/checkout-success-outcome"

describe("what the success page may say", () => {
  it("never says « will appear in your account » for a line that produced no order", () => {
    expect(successOutcome({ fulfilled: false, verifying: false, unallocatedLines: 1 })).toBe("unallocated")
    expect(successOutcome({ fulfilled: false, verifying: true, unallocatedLines: 1 })).toBe("unallocated")
    expect(successOutcome({ fulfilled: true, unallocatedLines: 1 })).toBe("partially_unallocated")
    expect(successOutcome({ fulfilled: true })).toBe("fulfilled")
    expect(successOutcome({ fulfilled: false, verifying: true })).toBe("verifying")
    expect(successOutcome({ fulfilled: false })).toBe("pending")
    expect(successOutcome({ error: "missing_session", unallocatedLines: 3 })).toBe("error")
  })

  it("the refund sentence follows the REAL state; unknown = not issued (no promise)", () => {
    expect(refundSentenceKey(null)).toBe("notTriggered")
    expect(refundSentenceKey(undefined)).toBe("notTriggered")
    expect(refundSentenceKey("not_triggered")).toBe("notTriggered")
    expect(refundSentenceKey("requested")).toBe("requested")
    expect(refundSentenceKey("in_progress")).toBe("inProgress")
    expect(refundSentenceKey("confirmed")).toBe("confirmed")
    expect(refundSentenceKey("uncertain")).toBeNull() // an unexplained refund: say nothing about money
  })

  it("stops waiting for an order that can not come", () => {
    expect(shouldKeepVerifying({ paid: true, fulfilled: false })).toBe(true)
    expect(shouldKeepVerifying({ paid: true, fulfilled: false, unallocatedLines: 1 })).toBe(false)
    expect(shouldKeepVerifying({ paid: true, fulfilled: true })).toBe(false)
  })
})

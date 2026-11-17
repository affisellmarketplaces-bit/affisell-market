import { describe, expect, it } from "vitest"

import { shouldKeepVerifying, successOutcome, summarizeUnallocatedTraces } from "@/lib/checkout-success-outcome"

describe("what the success page may say", () => {
  it("counts the traced lines of THIS session only, and the refunded ones among them", () => {
    const rows = [
      { action: "payment.unallocated_line", entityId: "cs_1:line:0" },
      { action: "payment.unallocated_line", entityId: "cs_1:line:2" },
      { action: "payment.unallocated_line.refunded", entityId: "cs_1:line:2" },
      { action: "payment.unallocated_line.alerted", entityId: "cs_1:line:0" },
      { action: "payment.unallocated_line", entityId: "cs_10:line:0" }, // another session sharing a prefix
      { action: "payment.unallocated_line.refunded", entityId: "cs_1:line:9" }, // a proof without trace is not counted
      { action: "payment.unallocated_line", entityId: null },
    ]
    expect(summarizeUnallocatedTraces("cs_1", rows)).toEqual({ lines: 2, refunded: 1 })
  })

  it("never says « will appear in your account » for a line that produced no order", () => {
    expect(successOutcome({ fulfilled: false, verifying: false, unallocatedLines: 1 })).toBe("unallocated")
    expect(successOutcome({ fulfilled: false, verifying: true, unallocatedLines: 1 })).toBe("unallocated")
    expect(successOutcome({ fulfilled: true, unallocatedLines: 1 })).toBe("partially_unallocated")
    expect(successOutcome({ fulfilled: true })).toBe("fulfilled")
    expect(successOutcome({ fulfilled: false, verifying: true })).toBe("verifying")
    expect(successOutcome({ fulfilled: false })).toBe("pending")
    expect(successOutcome({ error: "missing_session", unallocatedLines: 3 })).toBe("error")
  })

  it("stops waiting for an order that can not come", () => {
    expect(shouldKeepVerifying({ paid: true, fulfilled: false })).toBe(true)
    expect(shouldKeepVerifying({ paid: true, fulfilled: false, unallocatedLines: 1 })).toBe(false)
    expect(shouldKeepVerifying({ paid: true, fulfilled: true })).toBe(false)
  })
})

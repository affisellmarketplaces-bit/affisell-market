import { describe, expect, it } from "vitest"

import { proportionalRefundShareCents } from "@/lib/transfer-reversal-amounts"
import { matchExistingTransfer, payableAfterRefunds } from "@/lib/transfers/payable-after-refunds"

describe("payable after refunds", () => {
  it("refund-then-payout pays exactly what payout-then-clawback leaves (any order of events, any rounding)", () => {
    let cases = 0
    for (const scheduled of [1, 99, 1_600, 3_201, 9_999]) {
      for (const total of [1_000, 13_000, 15_600, 99_999]) {
        for (const refunds of [[1], [500], [1_001, 1_001, 1_001], [total / 2], [total], [total, 1]]) {
          const paidLess = payableAfterRefunds({
            scheduledCents: scheduled,
            refundCents: refunds,
            orderChargedTotalCents: total,
          })
          // Paid in full, then each refund clawed back by the existing partial-refund clawback rule:
          const clawed = refunds.reduce((n, r) => n + proportionalRefundShareCents(scheduled, r, total), 0)
          expect(paidLess.payableCents, JSON.stringify({ scheduled, total, refunds })).toBe(
            Math.max(0, scheduled - clawed),
          )
          expect(paidLess.payableCents + paidLess.refundShareCents).toBe(scheduled)
          expect(paidLess.payableCents).toBeGreaterThanOrEqual(0)
          cases++
        }
      }
    }
    expect(cases).toBe(120)
  })

  it("no refund: the scheduled amount; full refund: nothing", () => {
    expect(
      payableAfterRefunds({ scheduledCents: 3_200, refundCents: [], orderChargedTotalCents: 13_000 }).payableCents,
    ).toBe(3_200)
    expect(
      payableAfterRefunds({ scheduledCents: 3_200, refundCents: [13_000], orderChargedTotalCents: 13_000 })
        .payableCents,
    ).toBe(0)
  })

  it("an existing transfer matches only on the same role AND destination", () => {
    const list = [
      { id: "tr_a", amount: 100, destination: "acct_sup", metadata: { role: "SUPPLIER" } },
      { id: "tr_b", amount: 200, destination: { id: "acct_aff" }, metadata: { role: "AFFILIATE" } },
      { id: "tr_c", amount: 300, destination: "acct_other", metadata: { role: "AFFILIATE" } },
    ]
    expect(matchExistingTransfer(list, { role: "AFFILIATE", destination: "acct_aff" })).toEqual({
      id: "tr_b",
      amount: 200,
      reversed: false,
    })
    expect(matchExistingTransfer(list, { role: "AFFILIATE", destination: "acct_x" })).toBeNull()
    expect(matchExistingTransfer([], { role: "SUPPLIER", destination: "acct_sup" })).toBeNull()
  })
})

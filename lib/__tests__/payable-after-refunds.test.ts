import { describe, expect, it } from "vitest"

import { proportionalRefundShareCents } from "@/lib/transfer-reversal-amounts"
import { findExistingTransfers, matchExistingTransfer, payableAfterRefunds } from "@/lib/transfers/payable-after-refunds"

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

  it("role match ignores case and accepts a role-less transfer to the same account; several are all returned", () => {
    const list = [
      { id: "tr_1", amount: 8_736, destination: "acct_sup", metadata: { role: "supplier" } },
      { id: "tr_2", amount: 8_736, destination: "acct_sup", metadata: { role: "SUPPLIER" } },
      { id: "tr_3", amount: 8_736, destination: "acct_sup", metadata: {} },
      { id: "tr_4", amount: 500, destination: "acct_sup", metadata: { role: "affiliate" } },
      { id: "tr_5", amount: 8_736, destination: "acct_other", metadata: { role: "supplier" } },
    ]
    expect(findExistingTransfers(list, { role: "SUPPLIER", destination: "acct_sup" }).map((t) => t.id)).toEqual([
      "tr_1",
      "tr_2",
      "tr_3",
    ])
    expect(matchExistingTransfer(list, { role: "SUPPLIER", destination: "acct_sup" })).toBeNull() // several → none adopted
    expect(matchExistingTransfer(list.slice(0, 1), { role: "SUPPLIER", destination: "acct_sup" })?.id).toBe("tr_1")
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

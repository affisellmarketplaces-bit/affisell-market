import { describe, expect, it } from "vitest"

import { buyerEarnCentsForLinePaid } from "@/lib/buyer-reward-earn"

describe("buyerEarnCentsForLinePaid", () => {
  it("credits the listing percentage on the amount actually paid, rounded down", () => {
    expect(buyerEarnCentsForLinePaid(1399, { buyerRewardKind: "CASHBACK", buyerRewardPercent: 5 })).toBe(69)
    expect(buyerEarnCentsForLinePaid(2402, { buyerRewardKind: "CASHBACK", buyerRewardPercent: 5 })).toBe(120)
  })

  it("credits nothing without an offer", () => {
    expect(buyerEarnCentsForLinePaid(21123, { buyerRewardKind: "NONE", buyerRewardPercent: 0 })).toBe(0)
    expect(buyerEarnCentsForLinePaid(21123, { buyerRewardKind: "CASHBACK", buyerRewardPercent: 0 })).toBe(0)
  })

  it("never credits a negative or absurd amount", () => {
    expect(buyerEarnCentsForLinePaid(-500, { buyerRewardKind: "CASHBACK", buyerRewardPercent: 5 })).toBe(0)
  })
})

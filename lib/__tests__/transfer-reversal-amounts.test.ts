import { describe, expect, it } from "vitest"

import {
  computeIncrementalReversalCents,
  proportionalRefundShareCents,
  transferFullyReversed,
} from "@/lib/transfer-reversal-amounts"

describe("transfer-reversal-amounts", () => {
  it("computes proportional share for a single refund event", () => {
    expect(proportionalRefundShareCents(1000, 500, 2000)).toBe(250)
    expect(proportionalRefundShareCents(1000, 2000, 2000)).toBe(1000)
  })

  it("caps partial reversal at available balance", () => {
    const plan = computeIncrementalReversalCents({
      originalCents: 1000,
      reversedSoFar: 750,
      refundAmountCents: 500,
      orderTotalCents: 2000,
      isFullRefund: false,
    })
    expect(plan.reverseCents).toBe(250)
    expect(plan.availableCents).toBe(250)
  })

  it("prevents over-reversal on cumulative partial refunds", () => {
    const first = computeIncrementalReversalCents({
      originalCents: 1000,
      reversedSoFar: 0,
      refundAmountCents: 500,
      orderTotalCents: 2000,
      isFullRefund: false,
    })
    expect(first.reverseCents).toBe(250)

    const second = computeIncrementalReversalCents({
      originalCents: 1000,
      reversedSoFar: 250,
      refundAmountCents: 500,
      orderTotalCents: 2000,
      isFullRefund: false,
    })
    expect(second.reverseCents).toBe(250)

    const third = computeIncrementalReversalCents({
      originalCents: 1000,
      reversedSoFar: 500,
      refundAmountCents: 500,
      orderTotalCents: 2000,
      isFullRefund: false,
    })
    expect(third.reverseCents).toBe(250)

    const fourth = computeIncrementalReversalCents({
      originalCents: 1000,
      reversedSoFar: 750,
      refundAmountCents: 500,
      orderTotalCents: 2000,
      isFullRefund: false,
    })
    expect(fourth.reverseCents).toBe(250)

    const exhausted = computeIncrementalReversalCents({
      originalCents: 1000,
      reversedSoFar: 1000,
      refundAmountCents: 500,
      orderTotalCents: 2000,
      isFullRefund: false,
    })
    expect(exhausted.skipReason).toBe("fully_reversed")
    expect(exhausted.reverseCents).toBe(0)
  })

  it("reverses only remaining balance on full refund", () => {
    const plan = computeIncrementalReversalCents({
      originalCents: 1000,
      reversedSoFar: 400,
      refundAmountCents: 1200,
      orderTotalCents: 2000,
      isFullRefund: true,
    })
    expect(plan.reverseCents).toBe(600)
    expect(plan.availableCents).toBe(600)
  })

  it("detects fully reversed transfers", () => {
    expect(transferFullyReversed(1000, 999)).toBe(false)
    expect(transferFullyReversed(1000, 1000)).toBe(true)
    expect(transferFullyReversed(1000, 1001)).toBe(true)
  })
})

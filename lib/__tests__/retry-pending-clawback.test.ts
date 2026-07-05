import { describe, expect, it, vi, beforeEach } from "vitest"

import { netClawbackCentsForRole } from "@/lib/payout-settlement"

describe("netClawbackCentsForRole", () => {
  it("sums CLAWBACK entries per role and ignores phantom_legacy", () => {
    const rows = [
      { beneficiaryRole: "SUPPLIER", entryType: "CLAWBACK", amountCents: 250, payoutRail: "ledger_only" },
      { beneficiaryRole: "SUPPLIER", entryType: "CLAWBACK", amountCents: 250, payoutRail: "ledger_only" },
      { beneficiaryRole: "SUPPLIER", entryType: "CLAWBACK", amountCents: 999, payoutRail: "phantom_legacy" },
      { beneficiaryRole: "AFFILIATE", entryType: "CLAWBACK", amountCents: 120, payoutRail: "ledger_only" },
      { beneficiaryRole: "SUPPLIER", entryType: "PAYOUT", amountCents: 1000, payoutRail: "connect" },
    ]
    expect(netClawbackCentsForRole(rows, "SUPPLIER")).toBe(500)
    expect(netClawbackCentsForRole(rows, "AFFILIATE")).toBe(120)
  })
})

describe("retry pending clawback cron", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("retries reversals then clears REFUND_PENDING_CLAWBACK when clawback succeeds", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "ord_pending" }])
    const findUnique = vi.fn().mockResolvedValue({
      id: "ord_pending",
      totalCents: 5000,
      sellingPriceCents: 5000,
      platformCommissionCents: 600,
      taxCents: 0,
      stripeRefunds: [{ stripeRefundId: "re_full", amountCents: 5000 }],
    })
    const update = vi.fn().mockResolvedValue({})
    const reverse = vi.fn().mockResolvedValue({ outcomes: [], attemptedReversalCount: 1 })

    vi.doMock("@/lib/prisma", () => ({
      prisma: { order: { findMany, findUnique, update } },
    }))
    vi.doMock("@/lib/stripe-transfer-reversal", () => ({
      reverseConnectTransfersForRefund: reverse,
    }))
    vi.doMock("@/lib/payout-reversal-safety", () => ({
      evaluateClawbackSafety: vi.fn().mockResolvedValue({
        allowed: true,
        reason: "reversals_verified",
        pendingClawback: false,
      }),
    }))
    vi.doMock("@/lib/order-payout", () => ({
      clawbackOrderPayoutsOnRefund: vi.fn().mockResolvedValue({ executed: true }),
    }))

    const { retryPendingClawbacks } = await import("@/lib/cron/retry-pending-clawback")
    const result = await retryPendingClawbacks(10)

    expect(reverse).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      scanned: 1,
      reversalRetried: 1,
      retried: 1,
      succeeded: 1,
      stillPending: 0,
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: "ord_pending" },
      data: { paymentSettlementStatus: "REFUNDED", status: "refunded" },
    })
  })

  it("leaves order pending when reversals retried but safety still blocks", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        order: {
          findMany: vi.fn().mockResolvedValue([{ id: "ord_stuck" }]),
          findUnique: vi.fn().mockResolvedValue({
            id: "ord_stuck",
            totalCents: 5000,
            sellingPriceCents: 5000,
            platformCommissionCents: 600,
            taxCents: 0,
            stripeRefunds: [
              { stripeRefundId: "re_a", amountCents: 2000 },
              { stripeRefundId: "re_b", amountCents: 3000 },
            ],
          }),
          update: vi.fn(),
        },
      },
    }))
    vi.doMock("@/lib/stripe-transfer-reversal", () => ({
      reverseConnectTransfersForRefund: vi.fn().mockResolvedValue({ outcomes: [], attemptedReversalCount: 0 }),
    }))
    vi.doMock("@/lib/payout-reversal-safety", () => ({
      evaluateClawbackSafety: vi.fn().mockResolvedValue({
        allowed: false,
        reason: "reversal_failed",
        pendingClawback: true,
      }),
    }))
    vi.doMock("@/lib/order-payout", () => ({
      clawbackOrderPayoutsOnRefund: vi.fn(),
    }))

    const { retryPendingClawbacks } = await import("@/lib/cron/retry-pending-clawback")
    const result = await retryPendingClawbacks()

    expect(result).toEqual({
      scanned: 1,
      reversalRetried: 2,
      retried: 0,
      succeeded: 0,
      stillPending: 1,
    })
  })

  it("replays each OrderStripeRefund with cumulative full-refund flag", async () => {
    const reverse = vi.fn().mockResolvedValue({ outcomes: [], attemptedReversalCount: 0 })

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ord_1",
            totalCents: 10_000,
            sellingPriceCents: 10_000,
            platformCommissionCents: 1200,
            taxCents: 0,
            stripeRefunds: [
              { stripeRefundId: "re_partial", amountCents: 2000 },
              { stripeRefundId: "re_full", amountCents: 8000 },
            ],
          }),
        },
      },
    }))
    vi.doMock("@/lib/stripe-transfer-reversal", () => ({
      reverseConnectTransfersForRefund: reverse,
    }))

    const { retryStripeReversalsForOrder } = await import("@/lib/cron/retry-pending-clawback")
    const count = await retryStripeReversalsForOrder("ord_1")

    expect(count).toBe(2)
    expect(reverse).toHaveBeenNthCalledWith(1, {
      orderId: "ord_1",
      stripeRefundId: "re_partial",
      refundAmountCents: 2000,
      orderTotalCents: 10_000,
      isFullRefund: false,
      refundKey: "re_partial",
    })
    expect(reverse).toHaveBeenNthCalledWith(2, {
      orderId: "ord_1",
      stripeRefundId: "re_full",
      refundAmountCents: 8000,
      orderTotalCents: 10_000,
      isFullRefund: true,
      refundKey: "re_full",
    })
  })
})

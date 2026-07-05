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

describe("retryPendingClawbacks", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("clears REFUND_PENDING_CLAWBACK when safety passes and clawback succeeds", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "ord_pending" }])
    const update = vi.fn().mockResolvedValue({})

    vi.doMock("@/lib/prisma", () => ({
      prisma: { order: { findMany, update } },
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

    expect(result).toEqual({ scanned: 1, retried: 1, succeeded: 1, stillPending: 0 })
    expect(update).toHaveBeenCalledWith({
      where: { id: "ord_pending" },
      data: { paymentSettlementStatus: "REFUNDED", status: "refunded" },
    })
  })

  it("leaves order pending when safety still blocks", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        order: {
          findMany: vi.fn().mockResolvedValue([{ id: "ord_stuck" }]),
          update: vi.fn(),
        },
      },
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

    expect(result).toEqual({ scanned: 1, retried: 0, succeeded: 0, stillPending: 1 })
  })
})

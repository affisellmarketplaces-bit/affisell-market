import { describe, expect, it, vi, beforeEach } from "vitest"

import {
  assessRefundReversalBatch,
  mapOutcomeToReversalStatus,
} from "@/lib/payout-reversal-safety"

describe("payout-reversal-safety", () => {
  describe("mapOutcomeToReversalStatus", () => {
    it("maps full depletion to SUCCESS", () => {
      expect(
        mapOutcomeToReversalStatus({
          runtimeStatus: "reversed",
          reverseCents: 250,
          originalCents: 1000,
          reversedSoFar: 750,
        })
      ).toBe("SUCCESS")
    })

    it("maps incremental partial to PARTIAL", () => {
      expect(
        mapOutcomeToReversalStatus({
          runtimeStatus: "reversed",
          reverseCents: 250,
          originalCents: 1000,
          reversedSoFar: 0,
        })
      ).toBe("PARTIAL")
    })

    it("maps Stripe error to FAILED", () => {
      expect(
        mapOutcomeToReversalStatus({
          runtimeStatus: "warning",
          reverseCents: 4500,
          originalCents: 4500,
          reversedSoFar: 0,
          reason: "insufficient funds",
        })
      ).toBe("FAILED")
    })

    it("maps already_reversed to SUCCESS", () => {
      expect(
        mapOutcomeToReversalStatus({
          runtimeStatus: "warning",
          reverseCents: 4500,
          originalCents: 4500,
          reversedSoFar: 0,
          reason: "already_reversed",
        })
      ).toBe("SUCCESS")
    })

    it("skips persistence for below-cent partial", () => {
      expect(
        mapOutcomeToReversalStatus({
          runtimeStatus: "skipped",
          reverseCents: 0,
          originalCents: 4500,
          reversedSoFar: 0,
          reason: "partial_below_cent",
        })
      ).toBeNull()
    })

    it("skips persistence when transfer fully reversed", () => {
      expect(
        mapOutcomeToReversalStatus({
          runtimeStatus: "skipped",
          reverseCents: 0,
          originalCents: 4500,
          reversedSoFar: 4500,
          reason: "fully_reversed",
        })
      ).toBeNull()
    })
  })

  describe("assessRefundReversalBatch", () => {
    it("allows clawback when all reversals succeeded", () => {
      const verdict = assessRefundReversalBatch(
        [{ status: "SUCCESS" }, { status: "SUCCESS" }],
        2,
        true
      )
      expect(verdict.allowed).toBe(true)
      expect(verdict.pendingClawback).toBe(false)
    })

    it("blocks clawback when any reversal failed", () => {
      const verdict = assessRefundReversalBatch(
        [{ status: "SUCCESS" }, { status: "FAILED" }],
        2,
        true
      )
      expect(verdict.allowed).toBe(false)
      expect(verdict.reason).toBe("reversal_failed")
      expect(verdict.pendingClawback).toBe(true)
    })

    it("blocks full clawback when only partial recovery", () => {
      const verdict = assessRefundReversalBatch([{ status: "PARTIAL" }], 1, true)
      expect(verdict.allowed).toBe(false)
      expect(verdict.reason).toBe("reversal_partial_only")
    })

    it("allows when no reversals were needed", () => {
      const verdict = assessRefundReversalBatch([], 0, true)
      expect(verdict.allowed).toBe(true)
      expect(verdict.reason).toBe("no_reversals_needed")
    })

    it("blocks when reversal rows are missing", () => {
      const verdict = assessRefundReversalBatch([{ status: "SUCCESS" }], 2, true)
      expect(verdict.allowed).toBe(false)
      expect(verdict.reason).toBe("reversal_incomplete")
    })
  })
})

describe("clawbackOrderPayoutsOnRefund safety gate", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("blocks clawback when Connect reversal is unknown", async () => {
    vi.doMock("@/lib/payout-reversal-safety", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/payout-reversal-safety")>()
      return {
        ...actual,
        evaluateClawbackSafety: vi.fn().mockResolvedValue({
          allowed: false,
          reason: "reversal_unknown",
          pendingClawback: true,
        }),
        markRefundPendingClawback: vi.fn().mockResolvedValue(undefined),
        alertClawbackBlocked: vi.fn(),
      }
    })

    const { clawbackOrderPayoutsOnRefund } = await import("@/lib/order-payout")
    const result = await clawbackOrderPayoutsOnRefund("ord_blocked")
    expect(result.executed).toBe(false)
    expect(result.skippedReason).toBe("reversal_unknown")
  })
})

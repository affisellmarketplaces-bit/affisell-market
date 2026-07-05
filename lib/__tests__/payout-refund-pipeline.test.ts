import { describe, expect, it, vi } from "vitest"

import {
  netRealizedLedgerCents,
  payoutReconcileExceedsTolerance,
  reconcileSingleOrderPayouts,
  stripeTransferNetCents,
  transferAttemptsNetCents,
} from "@/lib/payout-reconcile.shared"
import { assessRefundReversalBatch } from "@/lib/payout-reversal-safety"
import { computeIncrementalReversalCents } from "@/lib/transfer-reversal-amounts"

describe("payout-refund-pipeline critical paths", () => {
  it("full refund success — all reversals SUCCESS allows clawback", () => {
    const verdict = assessRefundReversalBatch(
      [{ status: "SUCCESS" }, { status: "SUCCESS" }],
      2,
      true
    )
    expect(verdict.allowed).toBe(true)
  })

  it("partial refund multiple times — cumulative capped at original", () => {
    let reversed = 0
    for (let i = 0; i < 4; i += 1) {
      const plan = computeIncrementalReversalCents({
        originalCents: 1000,
        reversedSoFar: reversed,
        refundAmountCents: 500,
        orderTotalCents: 2000,
        isFullRefund: false,
      })
      expect(plan.reverseCents).toBe(250)
      reversed += plan.reverseCents
    }
    expect(reversed).toBe(1000)

    const exhausted = computeIncrementalReversalCents({
      originalCents: 1000,
      reversedSoFar: reversed,
      refundAmountCents: 500,
      orderTotalCents: 2000,
      isFullRefund: false,
    })
    expect(exhausted.skipReason).toBe("fully_reversed")
  })

  it("reversal failure blocks clawback", () => {
    const verdict = assessRefundReversalBatch(
      [{ status: "FAILED" }],
      1,
      true
    )
    expect(verdict.allowed).toBe(false)
    expect(verdict.pendingClawback).toBe(true)
  })

  it("reconciliation detects ledger vs stripe net mismatch", async () => {
    const fetchStripeTransfer = vi.fn(async (id: string) => {
      if (id === "tr_sup") return { amount: 4500, amount_reversed: 1000 }
      return { amount: 1200, amount_reversed: 0 }
    })

    const divergences = await reconcileSingleOrderPayouts(
      {
        orderId: "ord_rec",
        supplierPayoutCents: 4500,
        affiliatePayoutCents: 1200,
        merchantPayoutLedger: [
          { entryType: "PAYOUT", amountCents: 4500, payoutRail: "connect" },
          { entryType: "PAYOUT", amountCents: 1200, payoutRail: "connect" },
        ],
        transferAttempts: [
          {
            amountCents: 4500,
            reversedAmountCents: 1000,
            stripeTransferId: "tr_sup",
            role: "SUPPLIER",
          },
          {
            amountCents: 1200,
            reversedAmountCents: 0,
            stripeTransferId: "tr_aff",
            role: "AFFILIATE",
          },
        ],
      },
      fetchStripeTransfer
    )

    const ledgerStripe = divergences.find((d) => d.kind === "ledger_vs_stripe_net")
    expect(ledgerStripe).toBeDefined()
    expect(ledgerStripe?.deltaCents).toBe(1000)
  })

  it("excludes phantom_legacy from ledger net", () => {
    expect(
      netRealizedLedgerCents([
        { entryType: "PAYOUT", amountCents: 5000, payoutRail: "phantom_legacy" },
        { entryType: "PAYOUT", amountCents: 4500, payoutRail: "connect" },
      ])
    ).toBe(4500)
  })

  it("stripe net uses amount minus amount_reversed", () => {
    expect(stripeTransferNetCents({ amount: 4500, amount_reversed: 1000 })).toBe(3500)
    expect(transferAttemptsNetCents([{ amountCents: 4500, reversedAmountCents: 1000 }])).toBe(3500)
  })

  it("already reversed idempotency — second identical share yields fully_reversed", () => {
    const first = computeIncrementalReversalCents({
      originalCents: 1000,
      reversedSoFar: 0,
      refundAmountCents: 2000,
      orderTotalCents: 2000,
      isFullRefund: true,
    })
    expect(first.reverseCents).toBe(1000)

    const replay = computeIncrementalReversalCents({
      originalCents: 1000,
      reversedSoFar: 1000,
      refundAmountCents: 2000,
      orderTotalCents: 2000,
      isFullRefund: true,
    })
    expect(replay.skipReason).toBe("fully_reversed")
  })

  it("tolerance allows 1 cent rounding delta", () => {
    expect(payoutReconcileExceedsTolerance(1000, 1001)).toBe(false)
    expect(payoutReconcileExceedsTolerance(1000, 1002)).toBe(true)
  })
})

import * as Sentry from "@sentry/nextjs"

import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

const TOLERANCE_CENTS = 1
const DEFAULT_LIMIT = 1000

export type PayoutReconcileDivergence = {
  orderId: string
  kind:
    | "ledger_vs_expected"
    | "attempt_vs_expected"
    | "stripe_vs_attempt"
    | "ledger_vs_attempt"
  expectedCents: number
  actualCents: number
  deltaCents: number
  detail?: string
}

export type ReconcilePayoutsResult = {
  scanned: number
  settled: number
  divergences: PayoutReconcileDivergence[]
  skippedNoPayout: number
}

function netLedgerCents(
  rows: Array<{ entryType: string; amountCents: number }>
): number {
  let net = 0
  for (const row of rows) {
    if (row.entryType === "CLAWBACK") net -= row.amountCents
    else net += row.amountCents
  }
  return net
}

function exceedsTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) > TOLERANCE_CENTS
}

async function sumStripeTransferCents(transferIds: string[]): Promise<number | null> {
  if (transferIds.length === 0) return 0
  const stripe = getStripeClient()
  let sum = 0
  for (const transferId of transferIds) {
    try {
      const transfer = await stripe.transfers.retrieve(transferId)
      sum += transfer.amount ?? 0
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.log("[reconcile-payouts]", { transferId, result: "stripe_fetch_error", reason })
      return null
    }
  }
  return sum
}

export async function reconcilePayouts(
  limit = DEFAULT_LIMIT
): Promise<ReconcilePayoutsResult> {
  const orders = await prisma.order.findMany({
    where: { status: "paid", paidAt: { not: null } },
    orderBy: { paidAt: "desc" },
    take: limit,
    select: {
      id: true,
      totalCents: true,
      sellingPriceCents: true,
      supplierPayoutCents: true,
      affiliatePayoutCents: true,
      platformCommissionCents: true,
      affisellFeeCents: true,
      merchantPayoutLedger: {
        select: { entryType: true, amountCents: true, payoutRail: true },
      },
      transferAttempts: {
        where: { status: "SUCCESS" },
        select: { amountCents: true, stripeTransferId: true, role: true },
      },
    },
  })

  const divergences: PayoutReconcileDivergence[] = []
  let settled = 0
  let skippedNoPayout = 0

  for (const order of orders) {
    const successAttempts = order.transferAttempts
    if (successAttempts.length === 0 && order.merchantPayoutLedger.length === 0) {
      skippedNoPayout += 1
      continue
    }

    settled += 1
    const expectedCents = order.supplierPayoutCents + order.affiliatePayoutCents
    const ledgerCents = netLedgerCents(order.merchantPayoutLedger)
    const attemptCents = successAttempts.reduce((sum, a) => sum + a.amountCents, 0)

    const totalCents = order.totalCents ?? order.sellingPriceCents
    const feeCents =
      order.affisellFeeCents ??
      Math.max(0, totalCents - expectedCents - (order.platformCommissionCents ?? 0))
    const totalMinusFees = totalCents - feeCents - (order.platformCommissionCents ?? 0)

    if (expectedCents > 0 && exceedsTolerance(ledgerCents, expectedCents)) {
      divergences.push({
        orderId: order.id,
        kind: "ledger_vs_expected",
        expectedCents,
        actualCents: ledgerCents,
        deltaCents: ledgerCents - expectedCents,
        detail: `totalMinusFees=${totalMinusFees}`,
      })
    }

    if (expectedCents > 0 && exceedsTolerance(attemptCents, expectedCents)) {
      divergences.push({
        orderId: order.id,
        kind: "attempt_vs_expected",
        expectedCents,
        actualCents: attemptCents,
        deltaCents: attemptCents - expectedCents,
      })
    }

    if (successAttempts.length > 0 && exceedsTolerance(ledgerCents, attemptCents)) {
      divergences.push({
        orderId: order.id,
        kind: "ledger_vs_attempt",
        expectedCents: attemptCents,
        actualCents: ledgerCents,
        deltaCents: ledgerCents - attemptCents,
      })
    }

    const transferIds = successAttempts
      .map((a) => a.stripeTransferId?.trim())
      .filter((id): id is string => Boolean(id))

    if (transferIds.length > 0) {
      const stripeCents = await sumStripeTransferCents(transferIds)
      if (stripeCents != null && exceedsTolerance(stripeCents, attemptCents)) {
        divergences.push({
          orderId: order.id,
          kind: "stripe_vs_attempt",
          expectedCents: attemptCents,
          actualCents: stripeCents,
          deltaCents: stripeCents - attemptCents,
          detail: transferIds.join(","),
        })
      }
    }
  }

  for (const d of divergences) {
    console.log("[reconcile-payouts]", {
      orderId: d.orderId,
      kind: d.kind,
      expectedCents: d.expectedCents,
      actualCents: d.actualCents,
      deltaCents: d.deltaCents,
      result: "divergence",
    })
    if (process.env.SENTRY_DSN?.trim()) {
      Sentry.captureMessage("Payout reconciliation divergence", {
        level: "error",
        extra: d,
      })
    }
  }

  console.log("[reconcile-payouts]", {
    scanned: orders.length,
    settled,
    skippedNoPayout,
    divergenceCount: divergences.length,
    result: divergences.length === 0 ? "clean" : "divergences",
  })

  return {
    scanned: orders.length,
    settled,
    divergences,
    skippedNoPayout,
  }
}

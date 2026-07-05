import * as Sentry from "@sentry/nextjs"

import {
  logPayoutReconcileDivergence,
  reconcileSingleOrderPayouts,
  type PayoutReconcileDivergence,
} from "@/lib/payout-reconcile.shared"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

const DEFAULT_LIMIT = 1000

export type ReconcilePayoutsResult = {
  scanned: number
  settled: number
  divergences: PayoutReconcileDivergence[]
  skippedNoPayout: number
}

export type { PayoutReconcileDivergence }

export async function reconcilePayouts(
  limit = DEFAULT_LIMIT
): Promise<ReconcilePayoutsResult> {
  const orders = await prisma.order.findMany({
    where: {
      paidAt: { not: null },
      OR: [
        { status: "paid" },
        { status: "refunded" },
        { paymentSettlementStatus: { in: ["SETTLED", "REFUNDED", "PARTIALLY_REFUNDED", "REFUND_PENDING_CLAWBACK"] } },
      ],
    },
    orderBy: { paidAt: "desc" },
    take: limit,
    select: {
      id: true,
      supplierPayoutCents: true,
      affiliatePayoutCents: true,
      merchantPayoutLedger: {
        select: { entryType: true, amountCents: true, payoutRail: true },
      },
      transferAttempts: {
        where: { status: "SUCCESS" },
        select: {
          amountCents: true,
          reversedAmountCents: true,
          stripeTransferId: true,
          role: true,
        },
      },
    },
  })

  const stripe = getStripeClient()
  const fetchStripeTransfer = async (transferId: string) => {
    try {
      return await stripe.transfers.retrieve(transferId)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.log("[reconcile-payouts]", { transferId, result: "stripe_fetch_error", reason })
      return null
    }
  }

  const divergences: PayoutReconcileDivergence[] = []
  let settled = 0
  let skippedNoPayout = 0

  for (const order of orders) {
    const hasPayout =
      order.transferAttempts.some((a) => a.stripeTransferId?.trim()) ||
      order.merchantPayoutLedger.length > 0

    if (!hasPayout) {
      skippedNoPayout += 1
      continue
    }

    settled += 1
    const orderDivergences = await reconcileSingleOrderPayouts(
      {
        orderId: order.id,
        supplierPayoutCents: order.supplierPayoutCents,
        affiliatePayoutCents: order.affiliatePayoutCents,
        merchantPayoutLedger: order.merchantPayoutLedger,
        transferAttempts: order.transferAttempts,
      },
      fetchStripeTransfer
    )
    divergences.push(...orderDivergences)
  }

  for (const divergence of divergences) {
    logPayoutReconcileDivergence(divergence)
    if (process.env.SENTRY_DSN?.trim()) {
      Sentry.captureMessage("Payout reconciliation divergence", {
        level: "error",
        extra: divergence,
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

import { ensureMarketplaceCheckoutFulfilled } from "@/lib/marketplace-checkout-fulfill"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { findOrderIdsForCheckoutSession } from "@/lib/stripe-marketplace-commission-split"
import { scheduleMarketplaceTransferAttempts } from "@/lib/transfers/schedule-from-checkout"

const GRACE_MS = 45_000
const BATCH_SIZE = 50

export type ReconcilePendingCheckoutResult = {
  ok: boolean
  scanned: number
  healed: number
  skippedUnpaid: number
  errors: string[]
}

/**
 * Heal marketplace rows stuck in PENDING after Stripe Checkout was paid
 * (webhook delay/drop or success-page verify skipped pre-created rows).
 */
export async function reconcilePendingCheckoutOrders(): Promise<ReconcilePendingCheckoutResult> {
  const cutoff = new Date(Date.now() - GRACE_MS)
  const pendingRows = await prisma.order.findMany({
    where: {
      status: "PENDING",
      stripeSessionId: { startsWith: "cs_" },
      createdAt: { lte: cutoff },
    },
    select: { id: true, stripeSessionId: true },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  })

  if (pendingRows.length === 0) {
    return { ok: true, scanned: 0, healed: 0, skippedUnpaid: 0, errors: [] }
  }

  const stripe = getStripeClient()
  let healed = 0
  let skippedUnpaid = 0
  const errors: string[] = []

  for (const row of pendingRows) {
    const sessionId = row.stripeSessionId
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      if (session.mode !== "payment" || session.payment_status !== "paid") {
        skippedUnpaid += 1
        continue
      }

      await ensureMarketplaceCheckoutFulfilled(session)

      const after = await prisma.order.findUnique({
        where: { id: row.id },
        select: { status: true },
      })
      if (after?.status !== "paid") {
        skippedUnpaid += 1
        console.log("[reconcile-checkout]", {
          orderId: row.id,
          sessionId,
          result: "skipped_still_pending",
        })
        continue
      }

      healed += 1
      const orderIds = await findOrderIdsForCheckoutSession(sessionId)
      for (const orderId of orderIds) {
        await scheduleMarketplaceTransferAttempts(session, orderId)
      }

      console.log("[reconcile-checkout]", {
        orderId: row.id,
        sessionId,
        result: "healed",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${row.id}: ${message}`)
      console.error("[reconcile-checkout]", { orderId: row.id, sessionId, error: message })
    }
  }

  console.log("[reconcile-checkout]", {
    scanned: pendingRows.length,
    healed,
    skippedUnpaid,
    errorCount: errors.length,
  })

  return {
    ok: errors.length === 0,
    scanned: pendingRows.length,
    healed,
    skippedUnpaid,
    errors,
  }
}

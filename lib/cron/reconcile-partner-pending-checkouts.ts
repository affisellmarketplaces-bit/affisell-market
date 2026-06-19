import { ensureMarketplaceCheckoutFulfilled } from "@/lib/marketplace-checkout-fulfill"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { findOrderIdsForCheckoutSession } from "@/lib/stripe-marketplace-commission-split"
import { scheduleMarketplaceTransferAttempts } from "@/lib/transfers/schedule-from-checkout"

const PARTNER_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
const PARTNER_BATCH_SIZE = 10

export type ReconcilePartnerPendingResult = {
  scanned: number
  healed: number
}

type PartnerScope = { supplierId: string } | { affiliateId: string }

/**
 * Heal recent PENDING rows for one supplier or affiliate (dashboard load / notifications poll).
 * No grace window — Stripe `paid` is the source of truth.
 */
export async function reconcilePartnerPendingCheckoutOrders(
  scope: PartnerScope
): Promise<ReconcilePartnerPendingResult> {
  const partnerWhere =
    "supplierId" in scope ? { supplierId: scope.supplierId } : { affiliateId: scope.affiliateId }

  const pendingRows = await prisma.order.findMany({
    where: {
      ...partnerWhere,
      status: "PENDING",
      stripeSessionId: { startsWith: "cs_" },
      createdAt: { gte: new Date(Date.now() - PARTNER_LOOKBACK_MS) },
    },
    select: { id: true, stripeSessionId: true },
    orderBy: { createdAt: "desc" },
    take: PARTNER_BATCH_SIZE,
  })

  if (pendingRows.length === 0) {
    return { scanned: 0, healed: 0 }
  }

  const sessionByOrderId = new Map<string, string>()
  for (const row of pendingRows) {
    if (!sessionByOrderId.has(row.stripeSessionId)) {
      sessionByOrderId.set(row.stripeSessionId, row.id)
    }
  }

  const stripe = getStripeClient()
  let healed = 0

  for (const [sessionId, orderId] of sessionByOrderId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      if (session.mode !== "payment" || session.payment_status !== "paid") {
        continue
      }

      await ensureMarketplaceCheckoutFulfilled(session)

      const after = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      })
      if (after?.status !== "paid") {
        console.log("[reconcile-partner-checkout]", {
          orderId,
          sessionId,
          result: "skipped_still_pending",
        })
        continue
      }

      healed += 1
      const orderIds = await findOrderIdsForCheckoutSession(sessionId)
      for (const oid of orderIds) {
        await scheduleMarketplaceTransferAttempts(session, oid)
      }

      console.log("[reconcile-partner-checkout]", {
        orderId,
        sessionId,
        ...("supplierId" in scope
          ? { supplierId: scope.supplierId }
          : { affiliateId: scope.affiliateId }),
        result: "healed",
      })
    } catch (error) {
      console.error("[reconcile-partner-checkout]", {
        orderId,
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { scanned: sessionByOrderId.size, healed }
}

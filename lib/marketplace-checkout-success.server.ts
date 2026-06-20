import { listingDisplayTitle } from "@/lib/affiliate-listing-display"
import {
  ensureMarketplaceCheckoutFulfilled,
  isMarketplaceCheckoutFulfilled,
  marketplaceCheckoutNeedsFulfillment,
} from "@/lib/marketplace-checkout-fulfill"
import { resolveCheckoutSuccessDisplay } from "@/lib/marketplace-checkout-success-display"
import { prisma } from "@/lib/prisma"
import { findOrderIdsForCheckoutSession } from "@/lib/stripe-marketplace-commission-split"
import { getStripeClient } from "@/lib/stripe"
import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import { scheduleMarketplaceTransferAttempts } from "@/lib/transfers/schedule-from-checkout"

export type PaidCheckoutSessionResult = {
  paid: boolean
  fulfilled: boolean
  orderId: string | null
  orderIds: string[]
  amountTotal: number | null
  currency: string
  productName: string | null
  productImageUrl: string | null
}

/** Idempotent: mark orders paid + partner notifications after Stripe Checkout. */
export async function fulfillPaidCheckoutSession(
  sessionId: string
): Promise<PaidCheckoutSessionResult> {
  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  })

  let orderIds = await findOrderIdsForCheckoutSession(sessionId)
  const paid = session.payment_status === "paid"

  if (session.mode === "payment" && paid && (await marketplaceCheckoutNeedsFulfillment(sessionId))) {
    await ensureMarketplaceCheckoutFulfilled(session)
    orderIds = await findOrderIdsForCheckoutSession(sessionId)

    for (const orderId of orderIds) {
      try {
        await scheduleMarketplaceTransferAttempts(session, orderId)
      } catch (error) {
        logStripeWebhookInfo({
          metric: "checkout_transfer_schedule_skipped",
          sessionId,
          orderId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    console.log("[checkout-success]", {
      sessionId,
      orderIds,
      result: "fulfilled",
    })
  }

  const fulfilled = paid && (await isMarketplaceCheckoutFulfilled(sessionId))

  const orderRows =
    orderIds.length > 0
      ? await prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: {
            totalCents: true,
            sellingPriceCents: true,
            quantity: true,
            variantLabel: true,
            variantImageUrl: true,
            currency: true,
            affiliateProduct: { select: { customTitle: true } },
            product: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : []

  const stripeLineDescription = session.line_items?.data?.[0]?.description?.trim() || null

  const display = resolveCheckoutSuccessDisplay({
    sessionAmountTotal: session.amount_total,
    sessionCurrency: session.currency,
    stripeLineDescription,
    orders: orderRows.map((order) => ({
      totalCents: order.totalCents,
      sellingPriceCents: order.sellingPriceCents,
      quantity: order.quantity,
      variantLabel: order.variantLabel,
      variantImageUrl: order.variantImageUrl,
      currency: order.currency,
      productName: listingDisplayTitle(order.affiliateProduct.customTitle, order.product.name),
    })),
  })

  return {
    paid,
    fulfilled,
    orderId: orderIds[0] ?? session.metadata?.orderId ?? null,
    orderIds,
    amountTotal: display.amountTotal,
    currency: display.currency,
    productName: display.productName,
    productImageUrl: display.productImageUrl,
  }
}

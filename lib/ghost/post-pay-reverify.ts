import type Stripe from "stripe"

import { checkStock } from "@/lib/ghost/check-stock"
import { GHOST_STOCK15_COUPON } from "@/lib/ghost/types"
import { readResendDeliveryConfig, sendResendEmail } from "@/lib/emails/resend-delivery"
import { getStripeClient } from "@/lib/stripe"
import { findOrderIdsForCheckoutSession } from "@/lib/stripe-marketplace-commission-split"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"

/**
 * Re-vérif Ghost après paiement, avant fulfill.
 * Si OOS → refund PI + email + skip fulfill.
 */
export async function ghostReverifyBeforeFulfill(
  session: Stripe.Checkout.Session
): Promise<{ refunded: boolean }> {
  const orderIds = await findOrderIdsForCheckoutSession(session.id)
  const orders =
    orderIds.length > 0
      ? await prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: {
            id: true,
            productId: true,
            customerEmail: true,
            product: {
              select: {
                id: true,
                name: true,
                supplierUrl: true,
                supplierSource: true,
                supplierProductId: true,
                sourceUrl: true,
                importSource: true,
                aliexpressProductId: true,
                lastPriceSupplier: true,
                basePriceCents: true,
                stock: true,
              },
            },
          },
        })
      : []

  // Session may not have PENDING orders yet — resolve from metadata
  let products = orders.map((o) => o.product).filter(Boolean)
  if (products.length === 0) {
    const apId =
      session.metadata?.affiliateProductId?.trim() ||
      session.metadata?.productId?.trim() ||
      ""
    if (apId) {
      const listing = await prisma.affiliateProduct.findUnique({
        where: { id: apId },
        select: {
          product: {
            select: {
              id: true,
              name: true,
              supplierUrl: true,
              supplierSource: true,
              supplierProductId: true,
              sourceUrl: true,
              importSource: true,
              aliexpressProductId: true,
              lastPriceSupplier: true,
              basePriceCents: true,
              stock: true,
            },
          },
        },
      })
      if (listing?.product) products = [listing.product]
    }
  }

  for (const product of products) {
    if (!product) continue
    const stock = await checkStock(product)
    if (stock.status !== "out_of_stock") continue

    const pi =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id

    if (pi) {
      try {
        const stripe = getStripeClient()
        await stripe.refunds.create(
          { payment_intent: pi, reason: "requested_by_customer" },
          { idempotencyKey: `ghost-oos-refund:${session.id}:${product.id}` }
        )
      } catch (e) {
        console.log("[ghost-webhook]", {
          result: "refund_failed",
          sessionId: session.id,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }

    const email =
      orders.find((o) => o.productId === product.id)?.customerEmail ||
      session.customer_details?.email ||
      session.customer_email ||
      null

    if (email) {
      const config = readResendDeliveryConfig()
      if (config) {
        await sendResendEmail({
          context: "ghost-oos-refund",
          config,
          intendedTo: email,
          subject: `Rupture — remboursement + code ${GHOST_STOCK15_COUPON}`,
          html: `<p>Le produit <strong>${product.name}</strong> est en rupture chez le fournisseur.</p>
<p>Nous avons déclenché un <strong>remboursement instantané</strong>.</p>
<p>Code promo : <strong>${GHOST_STOCK15_COUPON}</strong> (−15%).</p>`,
        })
      }
    }

    void opsWebhookAlert(
      `[Ghost] OOS post-pay refund session=${session.id} product=${product.id}`
    )
    console.log("[ghost-webhook]", {
      sessionId: session.id,
      productId: product.id,
      result: "refunded_oos",
    })
    return { refunded: true }
  }

  return { refunded: false }
}

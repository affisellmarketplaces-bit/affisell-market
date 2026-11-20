import type Stripe from "stripe"

import { checkStock } from "@/lib/ghost/check-stock"
import { ensureGhostStockSchema } from "@/lib/ghost/ensure-ghost-schema"
import { GHOST_STOCK15_COUPON } from "@/lib/ghost/types"
import { readResendDeliveryConfig, sendResendEmail } from "@/lib/emails/resend-delivery"
import { alertRefundProblem } from "@/lib/money/refund-alert"
import { classifyStripeRefundError, resolveRefundAmountCents } from "@/lib/money/refund-guard"
import { evaluateRefundEligibility } from "@/lib/orders/payment-state"
import { getStripeClient } from "@/lib/stripe"
import { findOrderIdsForCheckoutSession } from "@/lib/stripe-marketplace-commission-split"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { isPrismaMissingColumnError } from "@/lib/prisma-missing-column"
import { prisma } from "@/lib/prisma"

const ghostProductSelect = {
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
} as const

const productSelectWithoutGhost = {
  id: true,
  name: true,
  sourceUrl: true,
  importSource: true,
  aliexpressProductId: true,
  basePriceCents: true,
  stock: true,
} as const

function padGhostProductFields<T extends Record<string, unknown>>(product: T) {
  return {
    supplierUrl: null as string | null,
    supplierSource: null as string | null,
    supplierProductId: null as string | null,
    lastPriceSupplier: null,
    ...product,
  }
}

/**
 * Re-vérif Ghost après paiement, avant fulfill.
 * Si OOS → refund (montant EXPLICITE) + email + skip fulfill.
 *
 * Résultat : `refunded: true` = le remboursement existe (créé ici ou déjà fait) → ne pas fulfiller ;
 * `refundFailed: true` = rupture constatée mais le remboursement n'a PAS eu lieu (alerte levée, aucun e-mail
 * « remboursé » envoyé) → ne pas fulfiller non plus ; les commandes restent en attente, donc le cron de
 * réconciliation repasse ici et rejoue le remboursement (clé d'idempotence stable).
 */
export async function ghostReverifyBeforeFulfill(
  session: Stripe.Checkout.Session
): Promise<{ refunded: boolean; refundFailed?: boolean }> {
  await ensureGhostStockSchema()

  const orderIds = await findOrderIdsForCheckoutSession(session.id)

  async function loadOrdersWithGhost() {
    if (orderIds.length === 0) return []
    return prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        productId: true,
        customerEmail: true,
        status: true,
        paymentSettlementStatus: true,
        product: { select: ghostProductSelect },
      },
    })
  }

  async function loadOrdersWithoutGhost() {
    if (orderIds.length === 0) return []
    const rows = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        productId: true,
        customerEmail: true,
        status: true,
        paymentSettlementStatus: true,
        product: { select: productSelectWithoutGhost },
      },
    })
    return rows.map((o) => ({
      ...o,
      product: o.product ? padGhostProductFields(o.product) : o.product,
    }))
  }

  let orders: Awaited<ReturnType<typeof loadOrdersWithGhost>>
  try {
    orders = await loadOrdersWithGhost()
  } catch (error: unknown) {
    if (!isPrismaMissingColumnError(error)) throw error
    console.log("[ghost-webhook]", {
      result: "ghost_p2022_retry",
      sessionId: session.id,
      error: error instanceof Error ? error.message : String(error),
    })
    await ensureGhostStockSchema({ force: true })
    try {
      orders = await loadOrdersWithGhost()
    } catch (retryError: unknown) {
      if (!isPrismaMissingColumnError(retryError)) throw retryError
      console.log("[ghost-webhook]", {
        result: "ghost_select_fallback",
        sessionId: session.id,
      })
      orders = (await loadOrdersWithoutGhost()) as typeof orders
    }
  }

  // Session may not have PENDING orders yet — resolve from metadata
  let products = orders.map((o) => o.product).filter(Boolean)
  if (products.length === 0) {
    const apId =
      session.metadata?.affiliateProductId?.trim() ||
      session.metadata?.productId?.trim() ||
      ""
    if (apId) {
      try {
        const listing = await prisma.affiliateProduct.findUnique({
          where: { id: apId },
          select: { product: { select: ghostProductSelect } },
        })
        if (listing?.product) products = [listing.product]
      } catch (error: unknown) {
        if (!isPrismaMissingColumnError(error)) throw error
        await ensureGhostStockSchema({ force: true })
        try {
          const listing = await prisma.affiliateProduct.findUnique({
            where: { id: apId },
            select: { product: { select: ghostProductSelect } },
          })
          if (listing?.product) products = [listing.product]
        } catch (retryError: unknown) {
          if (!isPrismaMissingColumnError(retryError)) throw retryError
          console.log("[ghost-webhook]", {
            result: "ghost_listing_fallback",
            sessionId: session.id,
            apId,
          })
          const listing = await prisma.affiliateProduct.findUnique({
            where: { id: apId },
            select: { product: { select: productSelectWithoutGhost } },
          })
          if (listing?.product) products = [padGhostProductFields(listing.product)]
        }
      }
    }
  }

  for (const product of products) {
    if (!product) continue
    const stock = await checkStock(product)
    if (stock.status !== "out_of_stock") continue

    // State guard: every order of the session is already refunded (a replay after the webhook recorded it).
    if (
      orders.length > 0 &&
      orders.every((o) => {
        const eligibility = evaluateRefundEligibility(o)
        return !eligibility.ok && eligibility.reason === "already_refunded"
      })
    ) {
      console.log("[ghost-webhook]", { sessionId: session.id, productId: product.id, result: "already_refunded" })
      return { refunded: true }
    }

    const pi =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id

    // The WHOLE session is refunded because nothing of it is fulfilled afterwards (see the return below): the amount is
    // the session total minus what was already refunded, sent EXPLICITLY. `stripe.refunds.create` without `amount`
    // refunds whatever is left of the PaymentIntent, whatever that is.
    const alreadyRefundedCents =
      orderIds.length > 0
        ? ((
            await prisma.orderStripeRefund.aggregate({
              where: { orderId: { in: orderIds } },
              _sum: { amountCents: true },
            })
          )._sum?.amountCents ?? 0)
        : 0
    const decision = resolveRefundAmountCents({
      chargedTotalCents: session.amount_total,
      alreadyRefundedCents,
    })

    if (!decision.ok && decision.reason === "already_refunded") {
      console.log("[ghost-webhook]", { sessionId: session.id, productId: product.id, result: "already_refunded" })
      return { refunded: true }
    }

    let refundError: string | null = null
    let retryable = false
    if (!pi) {
      refundError = "no_payment_intent"
    } else if (!decision.ok) {
      refundError = decision.reason
    } else {
      try {
        const stripe = getStripeClient()
        await stripe.refunds.create(
          {
            payment_intent: pi,
            amount: decision.amountCents,
            reason: "requested_by_customer",
            metadata: { source: "ghost_oos", sessionId: session.id, productId: product.id },
          },
          // Stable per (session, product, amount): a retry of the same webhook / cron run returns the same refund.
          { idempotencyKey: `ghost-oos-refund:${session.id}:${product.id}:${decision.amountCents}` }
        )
      } catch (e) {
        const failure = classifyStripeRefundError(e)
        refundError = failure.message
        retryable = failure.retryable
      }
    }

    if (refundError) {
      console.log("[ghost-webhook]", { result: "refund_failed", sessionId: session.id, error: refundError })
      alertRefundProblem({
        source: "ghost_oos",
        subjectId: session.id,
        error: refundError,
        retryable,
        extra: { productId: product.id },
      })
      // No "you have been refunded" e-mail for a refund that did not happen; fulfilment stays skipped (OOS product).
      return { refunded: false, refundFailed: true }
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

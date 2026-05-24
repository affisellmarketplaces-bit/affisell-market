import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { handleMarketplaceThreeWaySplit } from "@/lib/stripe-marketplace-commission-split"
import { isInsufficientCapabilitiesError } from "@/lib/stripe-connect-transfer"
import {
  captureStripeWebhookException,
  logStripeWebhookError,
  logStripeWebhookInfo,
  stripeErrorFields,
} from "@/lib/stripe-webhook-observability"
import { createBlindDropshipPaidNotifications } from "@/lib/blind-dropship-notifications"
import { handleStripeChargeRefunded } from "@/lib/stripe-charge-refunded"
import { processMarketplaceCommissionForPaymentIntent } from "@/lib/stripe-marketplace-commission-split"
import { handleStripeInvoicePaymentFailed } from "@/lib/stripe-invoice-payment-failed"
import {
  activateProFromCheckoutSession,
  deactivateProFromSubscription,
} from "@/lib/stripe-pro"
import { inngest } from "@/inngest/client"

export type WebhookProcessResult = {
  orderId: string | null
  duplicate: boolean
  handled: boolean
}

export async function isStripeWebhookProcessed(eventId: string): Promise<boolean> {
  const row = await prisma.processedWebhook.findUnique({ where: { id: eventId } })
  return Boolean(row)
}

async function clearStripeOnboardedForAccount(
  tx: Prisma.TransactionClient,
  stripeAccountId: string
) {
  await tx.user.updateMany({
    where: { stripeAccountId },
    data: { stripeOnboardedAt: null },
  })
}

async function handleTransferSettlementError(
  error: unknown,
  orderId: string | null,
  tx: Prisma.TransactionClient
) {
  const fields = stripeErrorFields(error)

  if (isInsufficientCapabilitiesError(error)) {
    const accountId = fields.accountId
    if (accountId) {
      await clearStripeOnboardedForAccount(tx, accountId)
    }
    logStripeWebhookError({
      metric: "insufficient_capabilities_for_transfer",
      orderId,
      accountId,
      message: error instanceof Error ? error.message : String(error),
    })
    return
  }

  if (error instanceof Error && error.message.startsWith("AFFILIATE_ONBOARDING_REQUIRED:")) {
    const accountId = error.message.split(":")[1]?.trim()
    if (accountId) {
      await clearStripeOnboardedForAccount(tx, accountId)
    }
    logStripeWebhookError({
      metric: "affiliate_onboarding_required",
      orderId,
      accountId: accountId ?? null,
    })
    return
  }

  captureStripeWebhookException(error, { orderId, phase: "three_way_split", ...fields })
}

async function processCheckoutSessionCompleted(
  event: Stripe.Event,
  tx: Prisma.TransactionClient
): Promise<string | null> {
  const session = event.data.object as Stripe.Checkout.Session

  logStripeWebhookInfo({
    metric: "checkout.session.completed",
    eventId: event.id,
    sessionId: session.id,
    mode: session.mode,
    payment_status: session.payment_status,
    metadata: session.metadata,
  })

  if (session.mode === "subscription" && session.payment_status === "paid") {
    await activateProFromCheckoutSession(session)
    return session.metadata?.orderId ?? null
  }

  if (session.mode === "payment" && session.payment_status === "paid") {
    const orderId = session.metadata?.orderId?.trim()
    if (!orderId) {
      logStripeWebhookError({
        metric: "checkout_missing_order_id",
        eventId: event.id,
        sessionId: session.id,
      })
      return null
    }

    try {
      await handleMarketplaceThreeWaySplit(session, orderId, tx)
    } catch (error) {
      await handleTransferSettlementError(error, orderId, tx)
    }

    return orderId
  }

  return null
}

async function dispatchStripeEvent(
  event: Stripe.Event,
  tx: Prisma.TransactionClient
): Promise<string | null> {
  switch (event.type) {
    case "checkout.session.completed":
      return processCheckoutSessionCompleted(event, tx)
    case "customer.subscription.deleted": {
      await deactivateProFromSubscription(event.data.object as Stripe.Subscription)
      return null
    }
    case "invoice.payment_failed": {
      await handleStripeInvoicePaymentFailed(event.data.object as Stripe.Invoice)
      return null
    }
    case "charge.refunded": {
      await handleStripeChargeRefunded(event.data.object as Stripe.Charge)
      return null
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent
      const blindId = pi.metadata?.blindDropshipOrderId?.trim()
      if (!blindId || pi.metadata?.flow !== "blind_dropship") {
        try {
          await processMarketplaceCommissionForPaymentIntent(pi)
        } catch (error) {
          captureStripeWebhookException(error, {
            orderId: null,
            phase: "payment_intent.succeeded",
            ...stripeErrorFields(error),
          })
        }
      } else {
        const paid = Math.round(pi.amount_received ?? pi.amount ?? 0)
        const order = await tx.blindDropshipOrder.findUnique({ where: { id: blindId } })
        if (order && order.status === "pending_payment" && paid >= order.totalPaidCents - 1) {
          await tx.blindDropshipOrder.update({
            where: { id: blindId },
            data: { status: "paid" },
          })
          try {
            await createBlindDropshipPaidNotifications(blindId)
          } catch (e) {
            logStripeWebhookError({ metric: "blind_dropship_notifications_failed", blindId })
            captureStripeWebhookException(e, { blindId })
          }
          try {
            await inngest.send({ name: "blind/order.fulfill", data: { orderId: blindId } })
          } catch (e) {
            logStripeWebhookError({ metric: "blind_dropship_inngest_failed", blindId })
            captureStripeWebhookException(e, { blindId })
          }
        }
      }
      return null
    }
    default:
      return null
  }
}

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<WebhookProcessResult> {
  if (await isStripeWebhookProcessed(event.id)) {
    logStripeWebhookInfo({ metric: "webhook_duplicate", eventId: event.id, type: event.type })
    return { orderId: null, duplicate: true, handled: true }
  }

  let orderId: string | null = null

  try {
    await prisma.$transaction(
      async (tx) => {
        try {
          orderId = await dispatchStripeEvent(event, tx)
        } catch (error) {
          captureStripeWebhookException(error, {
            eventId: event.id,
            type: event.type,
            orderId,
            ...stripeErrorFields(error),
          })
        } finally {
          await tx.processedWebhook.create({
            data: { id: event.id, orderId },
          })
        }
      },
      { timeout: 12_000 }
    )
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: string }).code)
        : ""
    if (code === "P2002") {
      logStripeWebhookInfo({ metric: "webhook_duplicate_race", eventId: event.id })
      return { orderId: null, duplicate: true, handled: true }
    }
    throw error
  }

  return { orderId, duplicate: false, handled: true }
}

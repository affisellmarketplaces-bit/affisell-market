import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"
import StripeSdk from "stripe"

import { prisma } from "@/lib/prisma"
import { ensureMarketplaceCheckoutFulfilled } from "@/lib/marketplace-checkout-fulfill"
import {
  findOrderIdsForCheckoutSession,
  processMarketplaceCommissionForPaymentIntent,
} from "@/lib/stripe-marketplace-commission-split"
import { scheduleMarketplaceTransferAttempts } from "@/lib/transfers/schedule-from-checkout"
import { isInsufficientCapabilitiesError } from "@/lib/stripe-connect-transfer"
import {
  captureStripeWebhookException,
  logStripeWebhookError,
  logStripeWebhookInfo,
  stripeErrorFields,
} from "@/lib/stripe-webhook-observability"
import { getStripeClient } from "@/lib/stripe"
import { createBlindDropshipPaidNotifications } from "@/lib/blind-dropship-notifications"
import { handleStripeChargeRefunded } from "@/lib/stripe-charge-refunded"
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
  status?: string
  deferred?: boolean
}

type WebhookStatus = "success" | "failed" | "skipped"

async function syncUserCapabilitiesFromStripe(
  tx: Prisma.TransactionClient,
  stripeAccountId: string
) {
  const stripe = getStripeClient()
  const account = await stripe.accounts.retrieve(stripeAccountId)
  await tx.user.updateMany({
    where: { stripeAccountId },
    data: {
      stripeOnboardedAt: null,
      stripeCapabilities: account.capabilities as Prisma.InputJsonValue,
    },
  })
}

async function handleSplitErrors(
  splitErrors: { role: string; message: string; accountId?: string; code?: string }[],
  orderId: string,
  tx: Prisma.TransactionClient
) {
  for (const err of splitErrors) {
    const accountId = err.accountId?.trim()
    if (!accountId) continue

    if (
      err.code === "affiliate_onboarding_required" ||
      err.message.startsWith("AFFILIATE_ONBOARDING_REQUIRED:")
    ) {
      await syncUserCapabilitiesFromStripe(tx, accountId)
      logStripeWebhookError({
        level: "error",
        metric: "affiliate_onboarding_required",
        orderId,
        accountId,
        errorCode: err.code ?? null,
      })
      continue
    }

    if (err.code === "insufficient_capabilities_for_transfer") {
      await syncUserCapabilitiesFromStripe(tx, accountId)
      logStripeWebhookError({
        level: "error",
        metric: "insufficient_capabilities_for_transfer",
        orderId,
        accountId,
        errorCode: err.code,
      })
    }
  }
}

async function handleStripeTransferError(
  error: unknown,
  orderId: string | null,
  tx: Prisma.TransactionClient
) {
  const fields = stripeErrorFields(error)

  if (isInsufficientCapabilitiesError(error)) {
    const accountId = fields.accountId
    if (accountId) {
      await syncUserCapabilitiesFromStripe(tx, accountId)
    }
    logStripeWebhookError({
      level: "error",
      metric: "insufficient_capabilities_for_transfer",
      orderId,
      accountId: accountId ?? null,
      errorCode: "insufficient_capabilities_for_transfer",
      param: fields.param,
    })
    return
  }

  if (error instanceof Error && error.message.startsWith("AFFILIATE_ONBOARDING_REQUIRED:")) {
    const accountId = error.message.split(":")[1]?.trim()
    if (accountId) {
      await syncUserCapabilitiesFromStripe(tx, accountId)
    }
    logStripeWebhookError({
      level: "error",
      metric: "affiliate_onboarding_required",
      orderId,
      accountId: accountId ?? null,
    })
    return
  }

  if (error instanceof StripeSdk.errors.StripeError) {
    logStripeWebhookError({
      level: "error",
      metric: "stripe_error",
      orderId,
      errorCode: error.code ?? error.type,
      param: error.param ?? null,
      accountId: fields.accountId,
    })
    captureStripeWebhookException(error, { orderId, ...fields })
    return
  }

  captureStripeWebhookException(error, { orderId, phase: "webhook", ...fields })
}

async function processCheckoutSessionCompleted(
  event: Stripe.Event,
  tx: Prisma.TransactionClient
): Promise<{ orderId: string | null; status: WebhookStatus; error: string | null }> {
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
    return { orderId: session.metadata?.orderId ?? null, status: "success", error: null }
  }

  if (session.mode === "payment" && session.payment_status === "paid") {
    const orderIds = await findOrderIdsForCheckoutSession(session.id)
    if (orderIds.length === 0) {
      logStripeWebhookError({
        metric: "checkout_orders_not_found",
        eventId: event.id,
        sessionId: session.id,
      })
      return { orderId: null, status: "skipped", error: "orders_not_found" }
    }

    const checkoutStarted = Date.now()
    let primaryOrderId = orderIds[0]!
    let scheduledAny = false
    let lastReason: string | null = null

    try {
      for (const orderId of orderIds) {
        const scheduled = await scheduleMarketplaceTransferAttempts(session, orderId, tx)
        if (scheduled.scheduled) {
          scheduledAny = true
          primaryOrderId = orderId
        } else {
          lastReason = scheduled.reason ?? null
          if (scheduled.reason === "already_settled") {
            scheduledAny = true
            primaryOrderId = orderId
          }
        }
      }

      if (!scheduledAny) {
        return {
          orderId: primaryOrderId,
          status: "skipped",
          error: lastReason,
        }
      }

      logStripeWebhookInfo({
        level: "info",
        metric: "webhook_checkout_completed",
        orderId: primaryOrderId,
        orderCount: orderIds.length,
        duration_ms: Date.now() - checkoutStarted,
        supplierTransferId: null,
        affiliateTransferId: null,
        phase: "scheduled",
      })

      return { orderId: primaryOrderId, status: "success", error: null }
    } catch (error) {
      await handleStripeTransferError(error, primaryOrderId, tx)
      const msg = error instanceof Error ? error.message : String(error)
      return { orderId: primaryOrderId, status: "failed", error: msg }
    }
  }

  return { orderId: null, status: "skipped", error: null }
}

async function dispatchStripeEvent(
  event: Stripe.Event,
  tx: Prisma.TransactionClient
): Promise<{ orderId: string | null; status: WebhookStatus; error: string | null }> {
  switch (event.type) {
    case "checkout.session.completed":
      return processCheckoutSessionCompleted(event, tx)
    case "customer.subscription.deleted": {
      await deactivateProFromSubscription(event.data.object as Stripe.Subscription)
      return { orderId: null, status: "success", error: null }
    }
    case "invoice.payment_failed": {
      await handleStripeInvoicePaymentFailed(event.data.object as Stripe.Invoice)
      return { orderId: null, status: "success", error: null }
    }
    case "charge.refunded": {
      await handleStripeChargeRefunded(event.data.object as Stripe.Charge)
      return { orderId: null, status: "success", error: null }
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent
      const blindId = pi.metadata?.blindDropshipOrderId?.trim()
      if (!blindId || pi.metadata?.flow !== "blind_dropship") {
        try {
          await processMarketplaceCommissionForPaymentIntent(pi)
        } catch (error) {
          await handleStripeTransferError(error, null, tx)
          return {
            orderId: null,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          }
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
      return { orderId: null, status: "success", error: null }
    }
    default:
      return { orderId: null, status: "skipped", error: null }
  }
}

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<WebhookProcessResult> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.mode === "payment" && session.payment_status === "paid") {
      try {
        await ensureMarketplaceCheckoutFulfilled(session)
      } catch (error) {
        logStripeWebhookError({
          metric: "checkout_fulfill_failed",
          eventId: event.id,
          sessionId: session.id,
          error: error instanceof Error ? error.message : String(error),
        })
        captureStripeWebhookException(error, {
          eventId: event.id,
          sessionId: session.id,
          phase: "checkout_fulfill",
        })
      }
    }
  }

  const existing = await prisma.processedWebhook.findUnique({ where: { id: event.id } })
  if (existing) {
    logStripeWebhookInfo({
      level: "info",
      metric: "webhook_duplicate",
      eventId: event.id,
      type: event.type,
      orderId: existing.orderId,
    })
    return {
      orderId: existing.orderId,
      duplicate: true,
      handled: true,
      status: existing.status,
    }
  }

  let orderId: string | null = null
  let status: WebhookStatus = "skipped"
  let error: string | null = null

  try {
    await prisma.$transaction(
      async (tx) => {
        const race = await tx.processedWebhook.findUnique({ where: { id: event.id } })
        if (race) {
          status = race.status as WebhookStatus
          orderId = race.orderId
          return
        }

        try {
          const outcome = await dispatchStripeEvent(event, tx)
          orderId = outcome.orderId
          status = outcome.status
          error = outcome.error
        } catch (err) {
          status = "failed"
          error = err instanceof Error ? err.message : String(err)
          await handleStripeTransferError(err, orderId, tx)
        } finally {
          await tx.processedWebhook.create({
            data: {
              id: event.id,
              orderId,
              status,
              error,
            },
          })
        }
      },
      { timeout: 25_000 }
    )
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code: string }).code)
        : ""
    if (code === "P2002") {
      logStripeWebhookInfo({ metric: "webhook_duplicate_race", eventId: event.id })
      return { orderId: null, duplicate: true, handled: true }
    }
    captureStripeWebhookException(err, { eventId: event.id, type: event.type })
    try {
      await prisma.processedWebhook.create({
        data: {
          id: event.id,
          orderId,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        },
      })
    } catch {
      // race: already recorded
    }
    return { orderId, duplicate: false, handled: true, status: "failed" }
  }

  logStripeWebhookInfo({
    level: "info",
    metric: "webhook_processed",
    eventId: event.id,
    orderId,
    status,
  })

  return { orderId, duplicate: false, handled: true, status }
}

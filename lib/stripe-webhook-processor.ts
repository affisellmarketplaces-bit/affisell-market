import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"
import StripeSdk from "stripe"

import { prisma } from "@/lib/prisma"
import {
  ensureMarketplaceCheckoutFulfilled,
  marketplaceCheckoutNeedsFulfillment,
} from "@/lib/marketplace-checkout-fulfill"
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
  syncProFromSubscriptionUpdate,
} from "@/lib/stripe-pro"
import {
  activateSponsorCampaignFromCheckout,
  isSponsorCheckoutSession,
} from "@/lib/sponsor/activate-sponsor-campaign"
import { inngest } from "@/inngest/client"
import { autoAcceptBaseLegalOnStripeKyc } from "@/lib/legal/stripe-kyc-legal-acceptance"

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
    const proResult = await activateProFromCheckoutSession(session)
    console.log("[video-paywall]", {
      sessionId: session.id,
      activated: proResult.activated,
      reason: proResult.activated ? null : proResult.reason,
    })
    return { orderId: session.metadata?.orderId ?? null, status: "success", error: null }
  }

  if (session.mode === "payment" && session.payment_status === "paid" && isSponsorCheckoutSession(session)) {
    await activateSponsorCampaignFromCheckout(session, tx)
    return { orderId: null, status: "success", error: null }
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
        logStripeWebhookInfo({
          metric: "checkout_transfers_not_scheduled",
          orderId: primaryOrderId,
          orderCount: orderIds.length,
          reason: lastReason,
        })
        return {
          orderId: primaryOrderId,
          status: "success",
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
    case "customer.subscription.updated": {
      await syncProFromSubscriptionUpdate(event.data.object as Stripe.Subscription)
      return { orderId: null, status: "success", error: null }
    }
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
    case "checkout.session.expired": {
      const { handleStripeCheckoutSessionExpired } = await import(
        "@/lib/stripe-checkout-session-expired"
      )
      await handleStripeCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session)
      return { orderId: null, status: "success", error: null }
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent
      const blindId = pi.metadata?.blindDropshipOrderId?.trim()
      if (!blindId || pi.metadata?.flow !== "blind_dropship") {
        try {
          const { triggerAutoBuyForPaymentIntent } = await import("@/lib/fulfillment/auto-buy")
          await triggerAutoBuyForPaymentIntent(pi)
        } catch (e) {
          logStripeWebhookError({
            metric: "auto_buy_payment_intent_trigger_failed",
            paymentIntentId: pi.id,
          })
          captureStripeWebhookException(e, { paymentIntentId: pi.id })
        }
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
    case "account.updated": {
      const account = event.data.object as Stripe.Account
      await autoAcceptBaseLegalOnStripeKyc(account, tx)
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
      if (await marketplaceCheckoutNeedsFulfillment(session.id)) {
        await ensureMarketplaceCheckoutFulfilled(session)
      } else {
        logStripeWebhookInfo({
          metric: "checkout_fulfill_skipped_already_paid",
          sessionId: session.id,
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

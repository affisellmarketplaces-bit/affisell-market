import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { enqueueProcessTransfersJob } from "@/lib/transfers/enqueue-job"
import { runProcessTransfersJob } from "@/lib/transfers/process-transfers"
import { resetOrderTransferAttempts } from "@/lib/transfers/reset-order-transfers"
import { scheduleMarketplaceTransferAttempts } from "@/lib/transfers/schedule-from-checkout"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

type Tx = Prisma.TransactionClient

export type ThreeWaySplitError = {
  role: "supplier" | "affiliate"
  message: string
  accountId?: string
  code?: string
}

export type ThreeWaySplitResult = {
  supplierTransfer: Stripe.Transfer | null
  affiliateTransfer: Stripe.Transfer | null
  errors: ThreeWaySplitError[]
}

export { computeThreeWayAmounts } from "@/lib/transfers/schedule-from-checkout"
export { computeTransferAmountsFromOrder } from "@/lib/marketplace-split-amounts"

export async function assertTransfersActive(accountId: string) {
  const { getStripeClient } = await import("@/lib/stripe")
  const stripe = getStripeClient()
  const account = await stripe.accounts.retrieve(accountId)
  if (account.capabilities?.transfers !== "active") {
    throw new Error(`AFFILIATE_ONBOARDING_REQUIRED:${accountId}`)
  }
  return account
}

export async function findOrderIdsForCheckoutSession(sessionId: string): Promise<string[]> {
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ stripeSessionId: sessionId }, { stripeSessionId: { startsWith: `${sessionId}:line:` } }],
    },
    select: { id: true },
  })
  return orders.map((o) => o.id)
}

function attemptsToResult(orderId: string): Promise<ThreeWaySplitResult> {
  return prisma.order
    .findUnique({
      where: { id: orderId },
      include: { transferAttempts: true },
    })
    .then((order) => {
      if (!order) {
        return {
          supplierTransfer: null,
          affiliateTransfer: null,
          errors: [{ role: "supplier", message: "order_not_found" }],
        }
      }
      const errors: ThreeWaySplitError[] = []
      for (const a of order.transferAttempts) {
        if (a.status === "FAILED") {
          errors.push({
            role: a.role === "SUPPLIER" ? "supplier" : "affiliate",
            message: a.errorMessage ?? a.errorCode ?? "transfer_failed",
            accountId: a.destination,
            code: a.errorCode ?? undefined,
          })
        }
      }
      const supplier = order.transferAttempts.find((a) => a.role === "SUPPLIER")
      const affiliate = order.transferAttempts.find((a) => a.role === "AFFILIATE")
      return {
        supplierTransfer:
          supplier?.stripeTransferId != null
            ? ({ id: supplier.stripeTransferId } as Stripe.Transfer)
            : null,
        affiliateTransfer:
          affiliate?.stripeTransferId != null
            ? ({ id: affiliate.stripeTransferId } as Stripe.Transfer)
            : null,
        errors,
      }
    })
}

/** Schedules PENDING TransferAttempt rows; actual Stripe calls run in the background job. */
export async function handleMarketplaceThreeWaySplit(
  session: Stripe.Checkout.Session,
  orderId: string,
  tx?: Tx,
  options?: { runJobSync?: boolean }
): Promise<ThreeWaySplitResult> {
  const scheduled = await scheduleMarketplaceTransferAttempts(session, orderId, tx)
  if (!scheduled.scheduled) {
    return attemptsToResult(orderId)
  }

  if (options?.runJobSync) {
    await runProcessTransfersJob({ metric: "split_sync", orderId })
  } else {
    await enqueueProcessTransfersJob()
  }

  return attemptsToResult(orderId)
}

export const handleStripeCommissionSplit = handleMarketplaceThreeWaySplit

export async function resettleMarketplaceOrder(orderId: string): Promise<{
  ok: boolean
  error?: string
  result?: ThreeWaySplitResult
}> {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: "order_not_found" }

  await resetOrderTransferAttempts(orderId)
  const job = await runProcessTransfersJob({ metric: "resettle_run", orderId })
  const result = await attemptsToResult(orderId)
  return { ok: job.failed === 0 && result.errors.length === 0, result }
}

export async function settleMarketplaceOrdersFromCheckoutSession(
  sessionOrId: Stripe.Checkout.Session | string
): Promise<{ processedOrderIds: string[]; errors: string[] }> {
  const stripe = getStripeClient()
  const session =
    typeof sessionOrId === "string"
      ? await stripe.checkout.sessions.retrieve(sessionOrId, { expand: ["payment_intent"] })
      : sessionOrId

  if (session.payment_status !== "paid") {
    return { processedOrderIds: [], errors: ["session_not_paid"] }
  }

  const orderIds = await findOrderIdsForCheckoutSession(session.id)
  if (orderIds.length === 0) {
    return { processedOrderIds: [], errors: ["orders_not_found"] }
  }

  const processedOrderIds: string[] = []
  const errors: string[] = []

  for (const orderId of orderIds) {
    const result = await handleMarketplaceThreeWaySplit(session, orderId, undefined, {
      runJobSync: true,
    })
    if (result.errors.length === 0) {
      processedOrderIds.push(orderId)
    } else {
      errors.push(`${orderId}:${result.errors.map((e) => e.message).join("|")}`)
    }
  }

  return { processedOrderIds, errors }
}

async function checkoutSessionIdForPaymentIntent(paymentIntentId: string): Promise<string | null> {
  const stripe = getStripeClient()
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntentId,
    limit: 5,
  })
  return sessions.data[0]?.id ?? null
}

export async function processMarketplaceCommissionForPaymentIntent(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ processedOrderIds: string[]; errors: string[] }> {
  if (paymentIntent.metadata?.flow === "blind_dropship") {
    return { processedOrderIds: [], errors: [] }
  }

  const sessionId = await checkoutSessionIdForPaymentIntent(paymentIntent.id)
  if (sessionId) {
    const orderIds = await findOrderIdsForCheckoutSession(sessionId)
    if (orderIds.length > 0) {
      return settleMarketplaceOrdersFromCheckoutSession(sessionId)
    }
  }

  const ordersByPi = await prisma.order.findMany({
    where: { stripePaymentIntentId: paymentIntent.id },
    select: { stripeSessionId: true },
  })
  const sessionFromOrder = ordersByPi.find((o) => o.stripeSessionId)?.stripeSessionId
  if (sessionFromOrder) {
    const baseSessionId = sessionFromOrder.split(":line:")[0] ?? sessionFromOrder
    return settleMarketplaceOrdersFromCheckoutSession(baseSessionId)
  }

  return { processedOrderIds: [], errors: ["no_session_or_orders"] }
}

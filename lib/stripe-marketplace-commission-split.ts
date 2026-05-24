import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
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

export async function assertTransfersActive(accountId: string): Promise<Stripe.Account> {
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

async function resolveChargeId(
  stripe: ReturnType<typeof getStripeClient>,
  session: Stripe.Checkout.Session
): Promise<string | undefined> {
  const piRef = session.payment_intent
  const piId = typeof piRef === "string" ? piRef : piRef?.id
  if (!piId) return undefined
  const pi = await stripe.paymentIntents.retrieve(piId)
  const latest = pi.latest_charge
  return typeof latest === "string" ? latest : latest?.id
}

function splitError(
  role: "supplier" | "affiliate",
  error: unknown,
  accountId: string
): ThreeWaySplitError {
  if (error instanceof Error && error.message.startsWith("AFFILIATE_ONBOARDING_REQUIRED:")) {
    return { role, message: error.message, accountId, code: "affiliate_onboarding_required" }
  }
  const stripeErr =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: string; message?: string })
      : null
  return {
    role,
    message: error instanceof Error ? error.message : String(error),
    accountId,
    code: stripeErr?.code,
  }
}

async function createTransferSafe(args: {
  orderId: string
  role: "supplier" | "affiliate"
  amount: number
  destination: string
  sourceTransaction?: string
}): Promise<{ transfer: Stripe.Transfer | null; error: ThreeWaySplitError | null }> {
  const stripe = getStripeClient()
  try {
    await assertTransfersActive(args.destination)
    const transfer = await stripe.transfers.create(
      {
        amount: args.amount,
        currency: "eur",
        destination: args.destination,
        transfer_group: args.orderId,
        ...(args.sourceTransaction ? { source_transaction: args.sourceTransaction } : {}),
        metadata: { orderId: args.orderId, role: args.role },
      },
      { idempotencyKey: `tr_${args.orderId}_${args.role}` }
    )
    logStripeWebhookInfo({
      level: "info",
      metric: "transfer_created",
      orderId: args.orderId,
      role: args.role,
      amount: args.amount,
      destination: args.destination,
      id: transfer.id,
    })
    return { transfer, error: null }
  } catch (error) {
    return { transfer: null, error: splitError(args.role, error, args.destination) }
  }
}

export async function handleMarketplaceThreeWaySplit(
  session: Stripe.Checkout.Session,
  orderId: string,
  tx?: Tx
): Promise<ThreeWaySplitResult> {
  const db = tx ?? prisma
  const stripe = getStripeClient()
  const errors: ThreeWaySplitError[] = []

  logStripeWebhookInfo({ metric: "split_start", orderId, sessionId: session.id })

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { supplier: true, affiliate: true },
  })
  if (!order) {
    return {
      supplierTransfer: null,
      affiliateTransfer: null,
      errors: [{ role: "supplier", message: `Order ${orderId} not found` }],
    }
  }

  const supplierAlreadyPaid = (order.supplierPayoutCents ?? 0) > 0
  const affiliateAlreadyPaid = (order.affiliatePayoutCents ?? 0) > 0
  if (supplierAlreadyPaid && affiliateAlreadyPaid) {
    logStripeWebhookInfo({ metric: "split_already_settled", orderId })
    return { supplierTransfer: null, affiliateTransfer: null, errors: [] }
  }

  const totalCents = session.amount_total
  if (totalCents == null) {
    return {
      supplierTransfer: null,
      affiliateTransfer: null,
      errors: [{ role: "supplier", message: "Session amount_total missing" }],
    }
  }

  const supplierDestination = order.supplier.stripeAccountId?.trim()
  const affiliateDestination =
    order.affiliateStripeAccountId?.trim() || order.affiliate?.stripeAccountId?.trim()

  if (!supplierDestination) {
    errors.push({ role: "supplier", message: "Supplier stripeAccountId missing" })
  }
  if (!affiliateDestination) {
    errors.push({ role: "affiliate", message: "Affiliate stripeAccountId missing" })
  }
  if (errors.length > 0) {
    return { supplierTransfer: null, affiliateTransfer: null, errors }
  }

  const supplierPayoutCents = Math.floor(totalCents * 0.6)
  const affiliatePayoutCents = Math.floor(totalCents * 0.2667)
  const affisellFeeCents = totalCents - supplierPayoutCents - affiliatePayoutCents
  const stripeFeeCents = Math.round(totalCents * 0.029 + 25)
  const affisellNetCents = affisellFeeCents - stripeFeeCents

  logStripeWebhookInfo({
    metric: "three_way_split",
    orderId,
    supplierPayoutCents,
    affiliatePayoutCents,
    affisellFeeCents,
    affisellNetCents,
    transferGroup: orderId,
  })

  const chargeId = await resolveChargeId(stripe, session)

  let supplierTransfer: Stripe.Transfer | null = null
  let affiliateTransfer: Stripe.Transfer | null = null

  if (!supplierAlreadyPaid) {
    const supplierResult = await createTransferSafe({
      orderId,
      role: "supplier",
      amount: supplierPayoutCents,
      destination: supplierDestination!,
      sourceTransaction: chargeId,
    })
    supplierTransfer = supplierResult.transfer
    if (supplierResult.error) errors.push(supplierResult.error)
  }

  if (!affiliateAlreadyPaid) {
    const affiliateResult = await createTransferSafe({
      orderId,
      role: "affiliate",
      amount: affiliatePayoutCents,
      destination: affiliateDestination!,
      sourceTransaction: chargeId,
    })
    affiliateTransfer = affiliateResult.transfer
    if (affiliateResult.error) errors.push(affiliateResult.error)
  }

  const supplierOk = supplierAlreadyPaid || supplierTransfer != null
  const affiliateOk = affiliateAlreadyPaid || affiliateTransfer != null

  if (supplierOk && affiliateOk) {
    await db.order.update({
      where: { id: orderId },
      data: {
        status: "paid",
        supplierPayoutCents,
        affiliatePayoutCents,
        affisellFeeCents,
        stripeFeesCents: stripeFeeCents,
        totalCents,
        stripeSessionId: session.id,
        stripeChargeId: chargeId ?? order.stripeChargeId,
        stripeTransferId: supplierTransfer?.id ?? order.stripeTransferId,
        paymentSettlementStatus: "SETTLED",
      },
    })

    const now = new Date()
    await db.user.updateMany({
      where: {
        stripeAccountId: {
          in: [supplierDestination!, affiliateDestination!].filter(Boolean),
        },
      },
      data: { stripeOnboardedAt: now },
    })

    logStripeWebhookInfo({ metric: "split_end", orderId, status: "success" })
  } else {
    if (supplierOk && !affiliateAlreadyPaid) {
      await db.order.update({
        where: { id: orderId },
        data: {
          supplierPayoutCents,
          affisellFeeCents,
          stripeFeesCents: stripeFeeCents,
          totalCents,
          stripeSessionId: session.id,
          stripeChargeId: chargeId ?? order.stripeChargeId,
          stripeTransferId: supplierTransfer?.id ?? order.stripeTransferId,
          paymentSettlementStatus: "PENDING",
        },
      })
    }
    logStripeWebhookInfo({
      metric: "split_end",
      orderId,
      status: "partial",
      errorCount: errors.length,
    })
  }

  return { supplierTransfer, affiliateTransfer, errors }
}

/** @deprecated Utiliser `handleMarketplaceThreeWaySplit` */
export const handleStripeCommissionSplit = handleMarketplaceThreeWaySplit

export async function resettleMarketplaceOrder(orderId: string): Promise<{
  ok: boolean
  error?: string
  result?: ThreeWaySplitResult
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { supplier: true, affiliate: true },
  })
  if (!order) return { ok: false, error: "order_not_found" }

  if (!order.supplier.stripeOnboardedAt) {
    return { ok: false, error: "supplier_not_onboarded" }
  }
  if (!order.affiliate?.stripeOnboardedAt) {
    return { ok: false, error: "affiliate_not_onboarded" }
  }

  const sessionId = order.stripeSessionId?.split(":line:")[0]?.trim()
  if (!sessionId || sessionId.startsWith("pending_")) {
    return { ok: false, error: "no_checkout_session" }
  }

  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  })
  if (session.payment_status !== "paid") {
    return { ok: false, error: "session_not_paid" }
  }

  const result = await handleMarketplaceThreeWaySplit(session, orderId)
  return { ok: result.errors.length === 0, result }
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
    const result = await handleMarketplaceThreeWaySplit(session, orderId)
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

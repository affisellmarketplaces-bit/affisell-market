import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { computeTransferAmountsFromOrder } from "@/lib/marketplace-split-amounts"
import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

type Tx = Prisma.TransactionClient

export type ScheduleTransferResult = {
  orderId: string
  scheduled: boolean
  reason?: string
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

/** @deprecated Use computeTransferAmountsFromOrder — kept for scripts importing legacy name. */
export function computeThreeWayAmounts(totalCents: number) {
  const supplierPayoutCents = Math.floor(totalCents * 0.6)
  const affiliatePayoutCents = Math.floor(totalCents * 0.2667)
  const affisellFeeCents = totalCents - supplierPayoutCents - affiliatePayoutCents
  const stripeFeeCents = Math.round(totalCents * 0.029 + 25)
  return {
    supplierPayoutCents,
    affiliatePayoutCents,
    affisellFeeCents,
    stripeFeeCents,
  }
}

export async function scheduleMarketplaceTransferAttempts(
  session: Stripe.Checkout.Session,
  orderId: string,
  tx?: Tx
): Promise<ScheduleTransferResult> {
  const db = tx ?? prisma
  const stripe = getStripeClient()

  logStripeWebhookInfo({ metric: "split_schedule_start", orderId, sessionId: session.id })

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { supplier: true, affiliate: true, transferAttempts: true },
  })
  if (!order) return { orderId, scheduled: false, reason: "order_not_found" }

  const existingSuccess = order.transferAttempts.filter((a) => a.status === "SUCCESS")
  if (existingSuccess.length >= 2) {
    logStripeWebhookInfo({ metric: "split_already_settled", orderId })
    return { orderId, scheduled: false, reason: "already_settled" }
  }

  const supplierDestination = order.supplier.stripeAccountId?.trim()
  const affiliateDestination =
    order.affiliateStripeAccountId?.trim() || order.affiliate?.stripeAccountId?.trim()

  if (!supplierDestination || !affiliateDestination) {
    return { orderId, scheduled: false, reason: "missing_connect_account" }
  }

  const amounts = computeTransferAmountsFromOrder({
    basePriceCents: order.basePriceCents,
    sellingPriceCents: order.sellingPriceCents,
    affiliatePayoutCents: order.affiliatePayoutCents,
    affiliateMarginRetainedCents: order.affiliateMarginRetainedCents,
    affisellFeeCents: order.affisellFeeCents,
    supplierPriceCents: order.supplierPriceCents,
    affiliateMarginCents: order.affiliateMarginCents,
    supplierCommissionRateBps: order.supplierCommissionRateBps,
    affisellCommissionRateBps: order.affisellCommissionRateBps,
  })

  if (amounts.supplierPayoutCents + amounts.affiliateTransferCents <= 0) {
    return { orderId, scheduled: false, reason: "zero_payout" }
  }

  const chargeId = await resolveChargeId(stripe, session)

  await db.order.update({
    where: { id: orderId },
    data: {
      totalCents: amounts.lineTotalCents,
      supplierPayoutCents: amounts.supplierPayoutCents,
      affiliatePayoutCents: amounts.affiliateTransferCents,
      affisellFeeCents: amounts.affisellFeeCents,
      stripeFeesCents: amounts.stripeFeeCents,
      stripeSessionId: order.stripeSessionId || session.id,
      stripeChargeId: chargeId ?? order.stripeChargeId,
      splitStatus: "PENDING",
      status: "paid",
      paymentSettlementStatus: "PAID",
      affiliateStripeAccountId: affiliateDestination,
    },
  })

  const upsertAttempt = async (
    role: "SUPPLIER" | "AFFILIATE",
    amountCents: number,
    destination: string
  ) => {
    const current = order.transferAttempts.find((a) => a.role === role)
    if (current?.status === "SUCCESS") return

    await db.transferAttempt.upsert({
      where: { orderId_role: { orderId, role } },
      create: {
        orderId,
        role,
        amountCents,
        destination,
        status: "PENDING",
      },
      update: {
        amountCents,
        destination,
        status: "PENDING",
        errorCode: null,
        errorMessage: null,
        stripeTransferId: null,
      },
    })
  }

  await upsertAttempt("SUPPLIER", amounts.supplierPayoutCents, supplierDestination)
  await upsertAttempt("AFFILIATE", amounts.affiliateTransferCents, affiliateDestination)

  logStripeWebhookInfo({
    metric: "split_scheduled",
    orderId,
    lineTotalCents: amounts.lineTotalCents,
    supplierPayoutCents: amounts.supplierPayoutCents,
    affiliateTransferCents: amounts.affiliateTransferCents,
    affisellFeeCents: amounts.affisellFeeCents,
  })

  return { orderId, scheduled: true }
}

import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

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

export function computeThreeWayAmounts(totalCents: number) {
  const supplierPayoutCents = Math.floor(totalCents * 0.6)
  const affiliatePayoutCents = Math.floor(totalCents * 0.2667)
  const affisellFeeCents = totalCents - supplierPayoutCents - affiliatePayoutCents
  const stripeFeeCents = Math.round(totalCents * 0.029 + 25)
  return { supplierPayoutCents, affiliatePayoutCents, affisellFeeCents, stripeFeeCents }
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

  const totalCents = session.amount_total
  if (totalCents == null) return { orderId, scheduled: false, reason: "amount_total_missing" }

  const supplierDestination = order.supplier.stripeAccountId?.trim()
  const affiliateDestination =
    order.affiliateStripeAccountId?.trim() || order.affiliate?.stripeAccountId?.trim()

  if (!supplierDestination || !affiliateDestination) {
    return { orderId, scheduled: false, reason: "missing_connect_account" }
  }

  const amounts = computeThreeWayAmounts(totalCents)
  const chargeId = await resolveChargeId(stripe, session)

  await db.order.update({
    where: { id: orderId },
    data: {
      totalCents,
      supplierPayoutCents: amounts.supplierPayoutCents,
      affiliatePayoutCents: amounts.affiliatePayoutCents,
      affisellFeeCents: amounts.affisellFeeCents,
      stripeFeesCents: amounts.stripeFeeCents,
      stripeSessionId: session.id,
      stripeChargeId: chargeId ?? order.stripeChargeId,
      splitStatus: "PENDING",
      status: "paid",
      paymentSettlementStatus: "PAID",
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
  await upsertAttempt("AFFILIATE", amounts.affiliatePayoutCents, affiliateDestination)

  logStripeWebhookInfo({
    metric: "split_scheduled",
    orderId,
    supplierPayoutCents: amounts.supplierPayoutCents,
    affiliatePayoutCents: amounts.affiliatePayoutCents,
  })

  return { orderId, scheduled: true }
}

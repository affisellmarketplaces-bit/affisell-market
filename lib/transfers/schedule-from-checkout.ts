import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import {
  computeTransferAmountsFromOrder,
  logPhase1SplitCheck,
  orderSplitInputFromOrder,
} from "@/lib/marketplace-split-amounts"
import { logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { computeShipDeadlineAt } from "@/lib/supplier-ship-sla-shared"

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

  const supplierDestination = order.supplier.stripeAccountId?.trim() || null
  const affiliateDestination =
    order.affiliateStripeAccountId?.trim() || order.affiliate?.stripeAccountId?.trim() || null

  if (!supplierDestination && !affiliateDestination) {
    return { orderId, scheduled: false, reason: "missing_connect_account" }
  }

  const splitInput = orderSplitInputFromOrder(order)
  const amounts = computeTransferAmountsFromOrder(splitInput)

  const subtotalForCheck = order.subtotalCents ?? order.sellingPriceCents
  logPhase1SplitCheck(orderId, {
    subtotalCents: subtotalForCheck,
    supplierPayoutCents: amounts.supplierPayoutCents,
    affiliateTransferCents: amounts.affiliateTransferCents,
    supplierFeeCents: amounts.supplierFeeCents,
    affiliateFeeCents: amounts.affiliateFeeCents,
    usesAffisellAutoBuy: order.usesAffisellAutoBuy,
  })

  const chargeId = await resolveChargeId(stripe, session)

  let scheduledCount = 0

  const upsertAttempt = async (
    role: "SUPPLIER" | "AFFILIATE",
    amountCents: number,
    destination: string
  ) => {
    if (amountCents <= 0) return
    const current = order.transferAttempts.find((a) => a.role === role)
    if (current?.status === "SUCCESS") {
      scheduledCount += 1
      return
    }

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
    scheduledCount += 1
  }

  if (supplierDestination && amounts.supplierPayoutCents > 0) {
    await upsertAttempt("SUPPLIER", amounts.supplierPayoutCents, supplierDestination)
  }
  if (affiliateDestination && amounts.affiliateTransferCents > 0) {
    await upsertAttempt("AFFILIATE", amounts.affiliateTransferCents, affiliateDestination)
  }

  if (scheduledCount === 0) {
    return {
      orderId,
      scheduled: false,
      reason: !supplierDestination && !affiliateDestination
        ? "missing_connect_account"
        : "zero_payout",
    }
  }

  const paidAnchor = order.paidAt ?? new Date()
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
      paidAt: order.paidAt ?? paidAnchor,
      shipDeadlineAt: order.shipDeadlineAt ?? computeShipDeadlineAt(paidAnchor),
      paymentSettlementStatus: "PAID",
      affiliateStripeAccountId: affiliateDestination,
    },
  })

  logStripeWebhookInfo({
    metric: "split_scheduled",
    orderId,
    lineTotalCents: amounts.lineTotalCents,
    supplierPayoutCents: amounts.supplierPayoutCents,
    affiliateTransferCents: amounts.affiliateTransferCents,
    affisellFeeCents: amounts.affisellFeeCents,
    supplierFeeCents: amounts.supplierFeeCents,
    affiliateFeeCents: amounts.affiliateFeeCents,
    usesAffisellAutoBuy: order.usesAffisellAutoBuy,
    supplierScheduled: Boolean(supplierDestination && amounts.supplierPayoutCents > 0),
    affiliateScheduled: Boolean(affiliateDestination && amounts.affiliateTransferCents > 0),
  })

  return { orderId, scheduled: true }
}

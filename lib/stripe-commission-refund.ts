import type Stripe from "stripe"

import { calculateRefundSplit, orderToCommissionRefundSlice } from "@/lib/commission"
import { notifyOrderCancelled } from "@/lib/emails/notify-order-cancelled"
import {
  clawbackOrderPayoutsOnPartialRefund,
  clawbackOrderPayoutsOnRefund,
} from "@/lib/order-payout"
import {
  alertClawbackBlocked,
  assessRefundReversalBatch,
  evaluateClawbackSafety,
  markRefundPendingClawback,
} from "@/lib/payout-reversal-safety"
import { reverseConnectTransfersForRefund } from "@/lib/stripe-transfer-reversal"
import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

async function orderIdsForStripeCharge(charge: Stripe.Charge): Promise<string[]> {
  const byCharge = await prisma.order.findMany({
    where: { stripeChargeId: charge.id },
    select: { id: true },
  })
  if (byCharge.length > 0) return byCharge.map((o) => o.id)

  const pi = charge.payment_intent
  const piId = typeof pi === "string" ? pi : pi?.id
  if (!piId) return []

  const stripe = getStripeClient()
  const sessions = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 20 })
  const sessionIds = sessions.data.map((s) => s.id).filter(Boolean)
  if (sessionIds.length === 0) return []

  const orders = await prisma.order.findMany({
    where: {
      OR: sessionIds.flatMap((sid) => [
        { stripeSessionId: sid },
        { stripeSessionId: { startsWith: `${sid}:line:` } },
      ]),
    },
    select: { id: true },
  })
  return orders.map((o) => o.id)
}

export async function handleStripeChargeRefundedWithCommission(
  charge: Stripe.Charge
): Promise<{ processedOrderIds: string[] }> {
  const stripe = getStripeClient()
  const fullCharge =
    charge.refunds?.data && Array.isArray(charge.refunds.data)
      ? charge
      : await stripe.charges.retrieve(charge.id, { expand: ["refunds.data"] })

  const orderIds = await orderIdsForStripeCharge(fullCharge)
  const processedOrderIds: string[] = []

  for (const orderId of orderIds) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        totalCents: true,
        sellingPriceCents: true,
        platformCommissionCents: true,
        taxCents: true,
        paymentSettlementStatus: true,
      },
    })
    if (!order) continue

    const slice = orderToCommissionRefundSlice(order)
    const totalCents = slice.totalCents ?? order.sellingPriceCents
    let refundedSum = 0
    let lastStripeRefundId: string | null = null

    for (const refund of fullCharge.refunds?.data ?? []) {
      const existing = await prisma.orderStripeRefund.findUnique({
        where: { stripeRefundId: refund.id },
      })
      if (existing) {
        refundedSum += existing.amountCents
        continue
      }

      const amountCents = refund.amount ?? 0
      const chargeRefundedAfter = fullCharge.amount_refunded ?? refundedSum + amountCents
      const isFullRefund = chargeRefundedAfter >= totalCents - 1
      lastStripeRefundId = refund.id

      await reverseConnectTransfersForRefund({
        orderId: order.id,
        stripeRefundId: refund.id,
        refundAmountCents: amountCents,
        orderTotalCents: totalCents,
        isFullRefund,
        refundKey: refund.id,
      })

      const { commissionReturnedCents, taxReturnedCents } = calculateRefundSplit(slice, amountCents)

      await prisma.orderStripeRefund.create({
        data: {
          orderId: order.id,
          stripeRefundId: refund.id,
          amountCents,
          commissionReturnedCents,
          taxReturnedCents,
          reason: refund.reason ?? undefined,
        },
      })
      refundedSum += amountCents

      console.log("[commission_refund]", {
        orderId: order.id,
        metric: "commission_refund_recorded",
        stripeRefundId: refund.id,
        amountCents,
        commissionReturnedCents,
        taxReturnedCents,
      })

      if (!isFullRefund) {
        const partialSafety = await evaluateClawbackSafety(order.id, {
          stripeRefundId: refund.id,
          requireFullRecovery: false,
        })
        if (partialSafety.allowed) {
          await clawbackOrderPayoutsOnPartialRefund(order.id, {
            stripeRefundId: refund.id,
            refundAmountCents: amountCents,
            orderTotalCents: totalCents,
          })
        } else {
          alertClawbackBlocked(order.id, partialSafety.reason)
        }
      }
    }

    const chargeRefunded = fullCharge.amount_refunded ?? refundedSum
    const isFullRefund = chargeRefunded >= totalCents - 1

    let settlementStatus: "REFUNDED" | "PARTIALLY_REFUNDED" | "REFUND_PENDING_CLAWBACK" =
      isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED"

    if (isFullRefund) {
      const safety = lastStripeRefundId
        ? await evaluateClawbackSafety(order.id, {
            stripeRefundId: lastStripeRefundId,
            requireFullRecovery: true,
          })
        : await evaluateClawbackSafety(order.id, { requireFullRecovery: true })

      if (safety.allowed) {
        const clawback = await clawbackOrderPayoutsOnRefund(order.id, { skipSafetyCheck: true })
        if (!clawback.executed) {
          settlementStatus = "REFUND_PENDING_CLAWBACK"
          alertClawbackBlocked(order.id, clawback.skippedReason ?? "clawback_not_executed")
        }
      } else {
        await markRefundPendingClawback(order.id)
        settlementStatus = "REFUND_PENDING_CLAWBACK"
        alertClawbackBlocked(order.id, safety.reason)
      }
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentSettlementStatus: settlementStatus,
        ...(isFullRefund && settlementStatus === "REFUNDED" ? { status: "refunded" } : {}),
      },
    })

    if (isFullRefund && settlementStatus === "REFUNDED") {
      await notifyOrderCancelled(orderId, {
        cancelReason: "Remboursement Stripe",
        refundAmountCents: chargeRefunded,
        markRefunded: true,
      })
    }

    processedOrderIds.push(orderId)
  }

  return { processedOrderIds }
}

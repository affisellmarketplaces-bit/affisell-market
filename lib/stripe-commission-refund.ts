import type Stripe from "stripe"

import { calculateRefundSplit, orderToCommissionRefundSlice } from "@/lib/commission"
import {
  attributeRefundToOrder,
  isOrderFullyRefunded,
  orderChargedTotalCents,
} from "@/lib/money/split-guard"
import { notifyOrderCancelled } from "@/lib/emails/notify-order-cancelled"
import {
  clawbackOrderPayoutsOnPartialRefund,
  clawbackOrderPayoutsOnRefund,
} from "@/lib/order-payout"
import {
  alertClawbackBlocked,
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
        subtotalCents: true,
        sellingPriceCents: true,
        platformCommissionCents: true,
        taxCents: true,
        paymentSettlementStatus: true,
      },
    })
    if (!order) continue

    const totalCents = orderChargedTotalCents(order)
    const slice = orderToCommissionRefundSlice({ ...order, totalCents })
    let refundedSum = 0
    let lastStripeRefundId: string | null = null

    for (const refund of fullCharge.refunds?.data ?? []) {
      const attribution = attributeRefundToOrder({
        chargeOrderCount: orderIds.length,
        orderId: order.id,
        refundMetadataOrderId: refund.metadata?.orderId,
      })
      if (attribution !== "apply") {
        if (attribution === "ambiguous") {
          console.error("[commission_refund]", {
            metric: "refund_unattributed_multi_order",
            orderId: order.id,
            stripeRefundId: refund.id,
            chargeId: fullCharge.id,
            orderCount: orderIds.length,
          })
        }
        continue
      }
      const existing = await prisma.orderStripeRefund.findUnique({
        where: { stripeRefundId: refund.id },
      })
      if (existing) {
        refundedSum += existing.amountCents
        continue
      }

      const amountCents = refund.amount ?? 0
      const isFullRefund = isOrderFullyRefunded({
        chargeOrderCount: orderIds.length,
        chargeAmountRefundedCents: fullCharge.amount_refunded,
        orderRefundedSumCents: refundedSum + amountCents,
        orderChargedTotalCents: totalCents,
      })
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

    // Multi-order charge and no refund attributed to this order: leave it untouched.
    if (orderIds.length > 1 && refundedSum === 0) continue

    const chargeRefunded =
      orderIds.length <= 1 ? (fullCharge.amount_refunded ?? refundedSum) : refundedSum
    const isFullRefund = isOrderFullyRefunded({
      chargeOrderCount: orderIds.length,
      chargeAmountRefundedCents: fullCharge.amount_refunded,
      orderRefundedSumCents: refundedSum,
      orderChargedTotalCents: totalCents,
    })

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

      try {
        const { reverseSponsorSuccessFeesForOrder } = await import(
          "@/lib/sponsor/charge-sponsor-on-sale"
        )
        await reverseSponsorSuccessFeesForOrder(order.id, { fraction: 1 })
      } catch (sponsorRevErr) {
        console.error("[sponsor]", {
          result: "success_fee_reverse_failed",
          orderId: order.id,
          error: sponsorRevErr instanceof Error ? sponsorRevErr.message : String(sponsorRevErr),
        })
      }
    } else if (lastStripeRefundId && totalCents > 0) {
      try {
        const { reverseSponsorSuccessFeesForOrder } = await import(
          "@/lib/sponsor/charge-sponsor-on-sale"
        )
        const fraction = Math.min(1, chargeRefunded / totalCents)
        await reverseSponsorSuccessFeesForOrder(order.id, { fraction })
      } catch (sponsorRevErr) {
        console.error("[sponsor]", {
          result: "success_fee_partial_reverse_failed",
          orderId: order.id,
          error: sponsorRevErr instanceof Error ? sponsorRevErr.message : String(sponsorRevErr),
        })
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

import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { hasOpenDisputeHold } from "@/lib/orders/dispute-hold.server"
import { isOrderClosedForPayout, isOrderPayoutHeldForDispute } from "@/lib/orders/payment-state"
import { orderLegKey } from "@/lib/payouts/leg-model"
import { executeLegTransfer } from "@/lib/payouts/leg-transfer.server"
import { recordMarketplaceLegPaid } from "@/lib/payouts/marketplace-leg-record"
import { prisma } from "@/lib/prisma"
import { applyOrderSettlement } from "@/lib/transfers/process-transfers"
import { assertTransfersActive } from "@/lib/stripe-marketplace-commission-split"
import { getStripeClient } from "@/lib/stripe"

export type LightningPayoutResult =
  | { success: true }
  | { success: false; reason: string }

const orderSelect = {
  id: true,
  supplierId: true,
  affiliateId: true,
  productId: true,
  status: true,
  paymentSettlementStatus: true,
  payoutStatus: true,
  supplierPayoutCents: true,
  affiliatePayoutCents: true,
  stripePaymentIntentId: true,
  stripeChargeId: true,
  currency: true,
  product: { select: { name: true } },
} as const

function resolveLatestChargeId(
  paymentIntent: Stripe.PaymentIntent,
  fallbackChargeId: string | null
): string | undefined {
  const latest = paymentIntent.latest_charge
  const fromIntent = typeof latest === "string" ? latest : latest?.id
  return fromIntent ?? fallbackChargeId ?? undefined
}

/**
 * Instant Connect payout when supplier trust + Lightning flag qualify.
 * Pays each leg through the payout leg registry and records it with the same writer as the standard Connect job
 * (TransferAttempt + ledger): a leg is paid once, whichever rail claims it first.
 */
export async function triggerLightningPayout(orderId: string): Promise<LightningPayoutResult> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: orderSelect,
    })
    if (!order) {
      return { success: false, reason: "order_not_found" }
    }

    if (order.payoutStatus !== "PENDING") {
      return { success: false, reason: `payout_status_${order.payoutStatus.toLowerCase()}` }
    }

    // A refunded / cancelled order pays nothing — a lost dispute ends as REFUNDED / REFUND_PENDING_CLAWBACK, and its
    // `payoutStatus` is still PENDING, so the AfterShip "delivered" webhook would otherwise pay it out of the lost charge
    // (finalisation review #8). Same rule as `process-transfers`.
    if (isOrderClosedForPayout(order)) {
      return { success: false, reason: "order_closed" }
    }

    // A dispute (chargeback) is open on the charge: nothing leaves until it is decided (finalisation master doc, D7).
    // A ledger read error ends in the catch below as a refusal, never as a payout.
    if (isOrderPayoutHeldForDispute(order, await hasOpenDisputeHold(orderId))) {
      return { success: false, reason: "dispute_open" }
    }

    const [supplierProfile, supplierUser, affiliateUser] = await Promise.all([
      prisma.supplierProfile.findUnique({ where: { userId: order.supplierId } }),
      prisma.user.findUnique({
        where: { id: order.supplierId },
        select: { stripeAccountId: true },
      }),
      prisma.user.findUnique({
        where: { id: order.affiliateId },
        select: { stripeAccountId: true },
      }),
    ])

    if (!supplierProfile) {
      return { success: false, reason: "supplier_profile_not_found" }
    }
    if (!affiliateUser) {
      return { success: false, reason: "affiliate_not_found" }
    }

    if (supplierProfile.trustScore < 50 && !supplierProfile.lightningAdminOverride) {
      return { success: false, reason: "supplier_trust_score_too_low" }
    }
    if (!supplierProfile.lightningEnabled) {
      return { success: false, reason: "lightning_not_enabled" }
    }

    const supplierDestination = supplierUser?.stripeAccountId?.trim() ?? ""
    const affiliateDestination = affiliateUser.stripeAccountId?.trim() ?? ""
    if (!supplierDestination) {
      return { success: false, reason: "supplier_stripe_account_missing" }
    }
    if (!affiliateDestination) {
      return { success: false, reason: "affiliate_stripe_account_missing" }
    }

    const supplierAmountCents = order.supplierPayoutCents
    const affiliateAmountCents = order.affiliatePayoutCents
    if (supplierAmountCents <= 0 || affiliateAmountCents <= 0) {
      return { success: false, reason: "invalid_payout_amounts" }
    }

    if (!order.stripePaymentIntentId) {
      return { success: false, reason: "payment_intent_missing" }
    }

    const stripe = getStripeClient()
    const paymentIntent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId)
    if (paymentIntent.status !== "succeeded") {
      return { success: false, reason: `payment_intent_${paymentIntent.status}` }
    }

    await assertTransfersActive(supplierDestination)
    await assertTransfersActive(affiliateDestination)

    const currency = (order.currency ?? "EUR").toLowerCase()
    // Same source charge as the standard job when the order knows it (the frozen request of a leg must not depend on
    // which rail claims it first — A2).
    const sourceTransaction = order.stripeChargeId ?? resolveLatestChargeId(paymentIntent, null) ?? null
    const productName = order.product?.name ?? null

    // Each leg goes through the payout leg registry, like process-transfers and Légion: a leg the standard job already
    // paid comes back `already_paid` and is never paid twice (risk A3, 2026-11-25). A leg that does not end paid stops
    // Lightning here; the standard job picks the order up again later.
    const legs = [
      { role: "SUPPLIER" as const, amountCents: supplierAmountCents, destination: supplierDestination, userId: order.supplierId },
      { role: "AFFILIATE" as const, amountCents: affiliateAmountCents, destination: affiliateDestination, userId: order.affiliateId },
    ]
    const transferIds: string[] = []
    for (const legSpec of legs) {
      const leg = await executeLegTransfer({
        legKey: orderLegKey(orderId, legSpec.role),
        kind: "order",
        role: legSpec.role,
        rail: "lightning",
        orderId,
        transferGroup: orderId,
        params: { amountCents: legSpec.amountCents, currency, destination: legSpec.destination, sourceTransaction },
        onPaid: (tx, paid) =>
          recordMarketplaceLegPaid(tx, {
            orderId,
            role: legSpec.role,
            amountCents: paid.amountCents,
            destination: paid.destination,
            stripeTransferId: paid.stripeTransferId,
            paidAt: paid.paidAt,
            rail: "lightning",
            userId: legSpec.userId,
            productName,
          }),
      })
      if (leg.outcome === "already_paid" && leg.amountCents && leg.destination) {
        const amountCents = leg.amountCents
        const destination = leg.destination
        await prisma.$transaction((tx) =>
          recordMarketplaceLegPaid(tx, {
            orderId,
            role: legSpec.role,
            amountCents,
            destination,
            stripeTransferId: leg.stripeTransferId,
            paidAt: new Date(),
            rail: "connect",
            userId: legSpec.userId,
            productName,
          })
        )
      }
      if (leg.outcome !== "paid" && leg.outcome !== "already_paid") {
        await applyOrderSettlement(orderId)
        return { success: false, reason: `leg_${legSpec.role.toLowerCase()}_${leg.outcome}` }
      }
      transferIds.push(leg.stripeTransferId)
    }

    await applyOrderSettlement(orderId)
    const payoutTransferIds: Prisma.InputJsonValue = transferIds
    await prisma.order.update({ where: { id: orderId }, data: { payoutTransferIds } })

    console.log("[stripe-lightning]", {
      orderId,
      supplierTransferId: transferIds[0],
      affiliateTransferId: transferIds[1],
      supplierAmountCents,
      affiliateAmountCents,
      result: "paid",
    })

    try {
      const { payLegionOverrideForOrder } = await import("@/lib/legion/pay-referral-override")
      await payLegionOverrideForOrder(orderId)
    } catch (legionPayErr) {
      console.error("[legion]", {
        result: "override_pay_lightning_hook_failed",
        orderId,
        error: legionPayErr instanceof Error ? legionPayErr.message : String(legionPayErr),
      })
    }

    return { success: true }
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "unknown_lightning_payout_error"
    console.log("[stripe-lightning]", { orderId, result: "error", reason })
    return { success: false, reason }
  }
}

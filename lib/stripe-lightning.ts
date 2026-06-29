import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { assertTransfersActive } from "@/lib/stripe-marketplace-commission-split"
import { getStripeClient } from "@/lib/stripe"

export type LightningPayoutResult =
  | { success: true }
  | { success: false; reason: string }

const orderSelect = {
  id: true,
  supplierId: true,
  affiliateId: true,
  payoutStatus: true,
  supplierPayoutCents: true,
  affiliatePayoutCents: true,
  stripePaymentIntentId: true,
  stripeChargeId: true,
  currency: true,
} as const

function lightningIdempotencyKey(orderId: string, role: "supplier" | "affiliate"): string {
  return `lightning_${orderId}_${role}`
}

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
 * Isolated service — wire from cron/webhook in a later step.
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

    const [supplierProfile, affiliateProfile] = await Promise.all([
      prisma.supplierProfile.findUnique({ where: { userId: order.supplierId } }),
      prisma.affiliateProfile.findUnique({ where: { userId: order.affiliateId } }),
    ])

    if (!supplierProfile) {
      return { success: false, reason: "supplier_profile_not_found" }
    }
    if (!affiliateProfile) {
      return { success: false, reason: "affiliate_profile_not_found" }
    }

    if (supplierProfile.trustScore < 50) {
      return { success: false, reason: "supplier_trust_score_too_low" }
    }
    if (!supplierProfile.lightningEnabled) {
      return { success: false, reason: "lightning_not_enabled" }
    }

    const supplierDestination = supplierProfile.stripeAccountId?.trim() ?? ""
    const affiliateDestination = affiliateProfile.stripeAccountId?.trim() ?? ""
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
    const sourceTransaction = resolveLatestChargeId(paymentIntent, order.stripeChargeId)
    const transferBase = {
      currency,
      transfer_group: orderId,
      ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
    }

    const supplierTransfer = await stripe.transfers.create(
      {
        ...transferBase,
        amount: supplierAmountCents,
        destination: supplierDestination,
        metadata: { orderId, role: "supplier", lightning: "true" },
      },
      { idempotencyKey: lightningIdempotencyKey(orderId, "supplier") }
    )

    const affiliateTransfer = await stripe.transfers.create(
      {
        ...transferBase,
        amount: affiliateAmountCents,
        destination: affiliateDestination,
        metadata: { orderId, role: "affiliate", lightning: "true" },
      },
      { idempotencyKey: lightningIdempotencyKey(orderId, "affiliate") }
    )

    const payoutTransferIds: Prisma.InputJsonValue = [supplierTransfer.id, affiliateTransfer.id]

    const updated = await prisma.order.updateMany({
      where: { id: orderId, payoutStatus: "PENDING" },
      data: {
        payoutStatus: "PAID",
        payoutTransferIds,
        supplierPayoutAt: new Date(),
        affiliatePayoutAt: new Date(),
      },
    })

    if (updated.count === 0) {
      return { success: false, reason: "payout_already_processed" }
    }

    console.log("[stripe-lightning]", {
      orderId,
      supplierTransferId: supplierTransfer.id,
      affiliateTransferId: affiliateTransfer.id,
      supplierAmountCents,
      affiliateAmountCents,
      result: "paid",
    })

    return { success: true }
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "unknown_lightning_payout_error"
    console.log("[stripe-lightning]", { orderId, result: "error", reason })
    return { success: false, reason }
  }
}

import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import {
  recordStripePayoutSettlement,
  supersedePendingTransferAttempt,
} from "@/lib/payout-settlement"
import { computeSplitStatusFromAttempts } from "@/lib/transfers/compute-split-status"
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
  payoutStatus: true,
  supplierPayoutCents: true,
  affiliatePayoutCents: true,
  stripePaymentIntentId: true,
  stripeChargeId: true,
  currency: true,
  product: { select: { name: true } },
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

async function upsertLightningTransferAttempt(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string
    role: "SUPPLIER" | "AFFILIATE"
    amountCents: number
    destination: string
    stripeTransferId: string
    paidAt: Date
  }
): Promise<void> {
  await tx.transferAttempt.upsert({
    where: { orderId_role: { orderId: args.orderId, role: args.role } },
    create: {
      orderId: args.orderId,
      role: args.role,
      amountCents: args.amountCents,
      destination: args.destination,
      status: "SUCCESS",
      stripeTransferId: args.stripeTransferId,
      attempts: 1,
      lastAttemptAt: args.paidAt,
    },
    update: {
      amountCents: args.amountCents,
      destination: args.destination,
      status: "SUCCESS",
      stripeTransferId: args.stripeTransferId,
      errorCode: null,
      errorMessage: null,
      attempts: 1,
      lastAttemptAt: args.paidAt,
    },
  })
}

/**
 * Instant Connect payout when supplier trust + Lightning flag qualify.
 * Writes the same settlement artifacts as the standard Connect job (TransferAttempt + ledger).
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

    if (supplierProfile.trustScore < 50 && !supplierProfile.lightningAdminOverride) {
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

    const paidAt = new Date()
    const productName = order.product?.name ?? null

    const updated = await prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: { id: orderId, payoutStatus: "PENDING" },
        data: { payoutStatus: "PROCESSING" },
      })
      if (claim.count === 0) return 0

      await supersedePendingTransferAttempt(tx, orderId, "SUPPLIER", "SUPERSEDED_BY_LIGHTNING")
      await supersedePendingTransferAttempt(tx, orderId, "AFFILIATE", "SUPERSEDED_BY_LIGHTNING")

      await upsertLightningTransferAttempt(tx, {
        orderId,
        role: "SUPPLIER",
        amountCents: supplierAmountCents,
        destination: supplierDestination,
        stripeTransferId: supplierTransfer.id,
        paidAt,
      })
      await upsertLightningTransferAttempt(tx, {
        orderId,
        role: "AFFILIATE",
        amountCents: affiliateAmountCents,
        destination: affiliateDestination,
        stripeTransferId: affiliateTransfer.id,
        paidAt,
      })

      await recordStripePayoutSettlement(tx, {
        orderId,
        beneficiaryRole: "SUPPLIER",
        userId: order.supplierId,
        amountCents: supplierAmountCents,
        stripeTransferId: supplierTransfer.id,
        payoutRail: "lightning",
        productName,
        paidAt,
      })
      await recordStripePayoutSettlement(tx, {
        orderId,
        beneficiaryRole: "AFFILIATE",
        userId: order.affiliateId,
        amountCents: affiliateAmountCents,
        stripeTransferId: affiliateTransfer.id,
        payoutRail: "lightning",
        productName,
        paidAt,
      })

      const attempts = await tx.transferAttempt.findMany({ where: { orderId } })
      const splitStatus = computeSplitStatusFromAttempts(attempts)
      const payoutTransferIds: Prisma.InputJsonValue = [supplierTransfer.id, affiliateTransfer.id]

      await tx.order.update({
        where: { id: orderId },
        data: {
          payoutStatus: "PAID",
          payoutTransferIds,
          supplierPayoutAt: paidAt,
          affiliatePayoutAt: paidAt,
          splitStatus,
          paymentSettlementStatus: splitStatus === "SUCCESS" ? "SETTLED" : undefined,
        },
      })

      return 1
    })

    if (updated === 0) {
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
    await prisma.order.updateMany({
      where: { id: orderId, payoutStatus: "PROCESSING" },
      data: { payoutStatus: "PENDING" },
    })
    const reason =
      error instanceof Error ? error.message : "unknown_lightning_payout_error"
    console.log("[stripe-lightning]", { orderId, result: "error", reason })
    return { success: false, reason }
  }
}

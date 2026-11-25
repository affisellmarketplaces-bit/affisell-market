import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { recordStripePayoutSettlement } from "@/lib/payout-settlement"
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

/** Same key as process-transfers (`transfer_<order>_<ROLE>`): one key per leg, whatever the rail. */
function sharedLegIdempotencyKey(orderId: string, role: "SUPPLIER" | "AFFILIATE"): string {
  return `transfer_${orderId}_${role}`
}

/**
 * Any trace that a leg of this order was (or may have been) paid: a SUCCESS attempt or one carrying a transfer id, a
 * ledger payout with a transfer id, the order's own transfer references. Lightning pays nothing when one exists.
 */
export async function paidLegEvidence(orderId: string): Promise<string | null> {
  const [attempts, ledger, order] = await Promise.all([
    prisma.transferAttempt.count({
      where: { orderId, OR: [{ status: "SUCCESS" }, { stripeTransferId: { not: null } }] },
    }),
    prisma.merchantPayoutLedger.count({
      where: { orderId, entryType: "PAYOUT", stripeTransferId: { not: null } },
    }),
    prisma.order.findUnique({ where: { id: orderId }, select: { stripeTransferId: true, payoutTransferIds: true } }),
  ])
  if (attempts > 0) return "transfer_attempt"
  if (ledger > 0) return "payout_ledger"
  if (order?.stripeTransferId) return "order_transfer_reference"
  if (Array.isArray(order?.payoutTransferIds) && order.payoutTransferIds.length > 0) return "order_payout_transfer_ids"
  return null
}

/** Only errors that PROVE Stripe created nothing: a 4xx refusal (not 409, not an idempotency error) or a 429. */
export function isProvenNotCreated(err: unknown): boolean {
  const e = (err ?? {}) as { type?: unknown; statusCode?: unknown; rawType?: unknown }
  const type = typeof e.type === "string" ? e.type : ""
  const status = typeof e.statusCode === "number" ? e.statusCode : null
  if (type === "StripeIdempotencyError" || e.rawType === "idempotency_error") return false
  if (type === "StripeRateLimitError" || status === 429) return true
  if (status === null || status === 409 || status < 400 || status >= 500) return false
  return ["StripeInvalidRequestError", "StripeCardError", "StripePermissionError", "StripeAuthenticationError"].includes(type)
}

function stripeErrorCode(err: unknown): string {
  const e = (err ?? {}) as { code?: unknown; type?: unknown }
  return String((typeof e.code === "string" && e.code) || (typeof e.type === "string" && e.type) || "unknown").slice(0, 80)
}

function errMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 300)
}

async function releaseClaim(orderId: string): Promise<void> {
  await prisma.order.updateMany({ where: { id: orderId, payoutStatus: "PROCESSING" }, data: { payoutStatus: "PENDING" } })
}

async function alertInDoubt(orderId: string, detail: string): Promise<void> {
  console.error("[stripe-lightning]", { orderId, result: "in_doubt_order_kept_processing", detail })
  try {
    const { opsWebhookAlert } = await import("@/lib/ops-webhook")
    await opsWebhookAlert(
      `⚠️ Lightning payout IN DOUBT — order ${orderId} kept PROCESSING (no rail will pay it). ${detail}. ` +
        "Check Stripe transfers of transfer_group=" + orderId + " before any manual action."
    )
  } catch {
    /* the log line above is the fallback */
  }
}

/**
 * Instant Connect payout when supplier trust + Lightning flag qualify.
 * Writes the same settlement artifacts as the standard Connect job (TransferAttempt + ledger).
 * A3 hotfix (2026-11-25): refuses an order whose legs show any payment trace, claims the order BEFORE Stripe, shares the
 * standard job's idempotency key per leg, records each leg as soon as it is paid, and keeps an uncertain order PROCESSING.
 */
export async function triggerLightningPayout(orderId: string): Promise<LightningPayoutResult> {
  let claimed = false
  let stripeCalled = false
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
    const sourceTransaction = resolveLatestChargeId(paymentIntent, order.stripeChargeId)
    const transferBase = {
      currency,
      transfer_group: orderId,
      ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
    }
    const productName = order.product?.name ?? null

    // A3 guard (2026-11-25): never pay a leg the standard job — or an earlier Lightning run — may already have paid.
    const evidence = await paidLegEvidence(orderId)
    if (evidence) {
      return { success: false, reason: `leg_already_paid:${evidence}` }
    }

    // Claim BEFORE any Stripe call; process-transfers skips a PROCESSING order (lib/transfers/process-transfers.ts).
    const claim = await prisma.order.updateMany({
      where: { id: orderId, payoutStatus: "PENDING" },
      data: { payoutStatus: "PROCESSING" },
    })
    if (claim.count === 0) {
      return { success: false, reason: "payout_already_processed" }
    }
    claimed = true
    // A standard run may have recorded a transfer between the first read and the claim.
    const late = await paidLegEvidence(orderId)
    if (late) {
      await releaseClaim(orderId)
      claimed = false
      return { success: false, reason: `leg_already_paid:${late}` }
    }

    const legs = [
      { role: "SUPPLIER" as const, amountCents: supplierAmountCents, destination: supplierDestination, userId: order.supplierId },
      { role: "AFFILIATE" as const, amountCents: affiliateAmountCents, destination: affiliateDestination, userId: order.affiliateId },
    ]
    const transferIds: string[] = []
    for (const leg of legs) {
      let transferId: string
      try {
        stripeCalled = true
        const transfer = await stripe.transfers.create(
          {
            ...transferBase,
            amount: leg.amountCents,
            destination: leg.destination,
            metadata: { orderId, role: leg.role.toLowerCase(), lightning: "true" },
          },
          // The SAME key as process-transfers for this leg: two rails racing on one leg are refused by Stripe
          // (same key, other parameters = idempotency error) instead of paying it twice.
          { idempotencyKey: sharedLegIdempotencyKey(orderId, leg.role) }
        )
        transferId = transfer.id
      } catch (err) {
        if (isProvenNotCreated(err)) {
          // Nothing was created for this leg; legs paid before it are already recorded SUCCESS, so the standard job
          // will not pay them again. Hand the order back to it.
          await releaseClaim(orderId)
          claimed = false
          return { success: false, reason: `lightning_${leg.role.toLowerCase()}_refused:${stripeErrorCode(err)}` }
        }
        // A transfer MAY exist: keep the order PROCESSING (no rail pays it) and alert — a person checks Stripe.
        await alertInDoubt(orderId, `${leg.role} transfer outcome unknown (${stripeErrorCode(err)})`)
        return { success: false, reason: `lightning_outcome_uncertain:${leg.role.toLowerCase()}` }
      }

      // Record THIS leg now, not after both: a later failure must never leave a paid leg unrecorded.
      try {
        const paidAt = new Date()
        await prisma.$transaction(async (tx) => {
          await upsertLightningTransferAttempt(tx, {
            orderId,
            role: leg.role,
            amountCents: leg.amountCents,
            destination: leg.destination,
            stripeTransferId: transferId,
            paidAt,
          })
          await recordStripePayoutSettlement(tx, {
            orderId,
            beneficiaryRole: leg.role,
            userId: leg.userId,
            amountCents: leg.amountCents,
            stripeTransferId: transferId,
            payoutRail: "lightning",
            productName,
            paidAt,
          })
        })
      } catch (err) {
        await alertInDoubt(orderId, `${leg.role} transfer ${transferId} created but NOT recorded: ${errMessage(err)}`)
        return { success: false, reason: `lightning_record_failed:${leg.role.toLowerCase()}` }
      }
      transferIds.push(transferId)
    }

    const paidAt = new Date()
    const attempts = await prisma.transferAttempt.findMany({ where: { orderId } })
    const splitStatus = computeSplitStatusFromAttempts(attempts)
    const payoutTransferIds: Prisma.InputJsonValue = transferIds
    await prisma.order.update({
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
    claimed = false

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
    if (claimed && stripeCalled) {
      // A Stripe call was made: a transfer may exist. Never hand the order back blindly (A3, 2026-11-25).
      await alertInDoubt(orderId, `unexpected error after a Stripe call: ${errMessage(error)}`)
    } else if (claimed) {
      await releaseClaim(orderId)
    }
    const reason =
      error instanceof Error ? error.message : "unknown_lightning_payout_error"
    console.log("[stripe-lightning]", { orderId, result: "error", reason })
    return { success: false, reason }
  }
}

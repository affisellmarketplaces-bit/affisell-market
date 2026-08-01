import "server-only"

import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import { assertTransfersActive } from "@/lib/stripe-marketplace-commission-split"

/**
 * Pay Légion sponsor override after filleul affiliate leg is released.
 * Idempotent via legionPayoutStatus=paid_24h + Stripe idempotency key.
 * Does not replace Lightning / TransferAttempt — additive Connect transfer only for the 2% slice.
 */
export async function payLegionOverrideForOrder(
  orderId: string
): Promise<{ paid: boolean; transferId: string | null; reason?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      storeProfileId: true,
      legionOverrideAmount: true,
      legionPayoutStatus: true,
      stripeChargeId: true,
      status: true,
    },
  })
  if (!order?.storeProfileId) {
    return { paid: false, transferId: null, reason: "no_store_profile" }
  }
  if (order.legionPayoutStatus === "paid_24h") {
    return { paid: true, transferId: null, reason: "already_paid" }
  }

  const overrideEur = Number(order.legionOverrideAmount ?? 0)
  const overrideCents = Math.round(overrideEur * 100)
  if (overrideCents <= 0 || order.legionPayoutStatus !== "reserved") {
    return { paid: false, transferId: null, reason: "nothing_to_pay" }
  }

  const referral = await prisma.legionReferral.findFirst({
    where: { referredId: order.storeProfileId, status: "active" },
    select: {
      id: true,
      sponsorId: true,
      sponsor: {
        select: {
          username: true,
          user: { select: { id: true, stripeAccountId: true } },
        },
      },
      referred: { select: { username: true } },
    },
  })
  if (!referral?.sponsor.user.stripeAccountId) {
    console.log("[legion]", {
      result: "override_pay_skipped",
      orderId,
      reason: "sponsor_connect_missing",
    })
    return { paid: false, transferId: null, reason: "sponsor_connect_missing" }
  }

  const destination = referral.sponsor.user.stripeAccountId.trim()
  try {
    await assertTransfersActive(destination)
  } catch (err) {
    console.error("[legion]", {
      result: "override_pay_onboarding",
      orderId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { paid: false, transferId: null, reason: "sponsor_transfers_inactive" }
  }

  const stripe = getStripeClient()
  const filleulLabel = referral.referred.username ?? "filleul"

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: overrideCents,
        currency: "eur",
        destination,
        transfer_group: orderId,
        ...(order.stripeChargeId ? { source_transaction: order.stripeChargeId } : {}),
        description: `Légion override 2% — filleul @${filleulLabel}`,
        metadata: {
          order_id: orderId,
          rail: "legion_phase1",
          role: "sponsor",
          override_eur: String(overrideEur),
          sponsor_id: referral.sponsorId,
        },
      },
      { idempotencyKey: `legion_sponsor_phase1_${orderId}` }
    )

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, legionPayoutStatus: "reserved" },
        data: { legionPayoutStatus: "paid_24h" },
      })
      if (claimed.count === 0) return

      await tx.legionReferral.updateMany({
        where: { referredId: order.storeProfileId!, status: "active" },
        data: { totalOverrideEarned: { increment: overrideEur } },
      })

      await tx.merchantPayoutLedger.create({
        data: {
          orderId,
          userId: referral.sponsor.user.id,
          beneficiaryRole: "LEGION_SPONSOR",
          entryType: "LEGION_OVERRIDE",
          amountCents: overrideCents,
          idempotencyKey: `legion_override_${orderId}`,
          stripeTransferId: transfer.id,
          payoutRail: "connect",
          note: `Légion 2% override from @${filleulLabel}`,
        },
      }).catch(async (ledgerErr) => {
        // Idempotent replay — ledger row may already exist from a prior success.
        console.log("[legion]", {
          result: "override_ledger_exists",
          orderId,
          error: ledgerErr instanceof Error ? ledgerErr.message : String(ledgerErr),
        })
      })
    })

    console.log("[legion]", {
      result: "override_paid",
      orderId,
      transferId: transfer.id,
      overrideCents,
      sponsorId: referral.sponsorId,
    })

    return { paid: true, transferId: transfer.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("Unique constraint") || message.includes("idempotency")) {
      await prisma.order.updateMany({
        where: { id: orderId, legionPayoutStatus: "reserved" },
        data: { legionPayoutStatus: "paid_24h" },
      })
      return { paid: true, transferId: null, reason: "idempotent_replay" }
    }
    console.error("[legion]", {
      result: "override_pay_failed",
      orderId,
      error: message,
    })
    await prisma.order.updateMany({
      where: { id: orderId, legionPayoutStatus: "reserved" },
      data: { legionPayoutStatus: "failed" },
    })
    return { paid: false, transferId: null, reason: "stripe_error" }
  }
}

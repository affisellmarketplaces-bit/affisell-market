import "server-only"

import type { Prisma } from "@prisma/client"

import { hasOpenDisputeHold } from "@/lib/orders/dispute-hold.server"
import { isOrderClosedForPayout, isOrderPayoutHeldForDispute } from "@/lib/orders/payment-state"
import { insertPayoutLedgerRow } from "@/lib/payout-ledger"
import { orderLegKey } from "@/lib/payouts/leg-model"
import { executeLegTransfer } from "@/lib/payouts/leg-transfer.server"
import { prisma } from "@/lib/prisma"
import { assertTransfersActive } from "@/lib/stripe-marketplace-commission-split"

/**
 * Pay Légion sponsor override after filleul affiliate leg is released.
 * One leg of the payout leg registry (order × LEGION_SPONSOR). `legionPayoutStatus`: reserved → paid_24h, or in_doubt
 * (a transfer MAY exist — settled by reconciliation, never re-sent blindly) / failed (proved unpaid).
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
      paymentSettlementStatus: true,
    },
  })
  if (!order?.storeProfileId) {
    return { paid: false, transferId: null, reason: "no_store_profile" }
  }
  if (order.legionPayoutStatus === "paid_24h") {
    return { paid: true, transferId: null, reason: "already_paid" }
  }
  // A refunded / cancelled order (a lost dispute ends there too: REFUNDED / REFUND_PENDING_CLAWBACK) pays nothing: the
  // reversal of the Connect transfers does not cover this separate transfer, and the 15-minute catch-up of
  // `process-transfers` would otherwise pay the override once the sponsor onboards (finalisation review #8).
  if (isOrderClosedForPayout(order)) {
    return { paid: false, transferId: null, reason: "order_closed" }
  }
  // A dispute (chargeback) is open on the charge: the 2% override is part of the same money (finalisation master doc, D7).
  if (isOrderPayoutHeldForDispute(order, await hasOpenDisputeHold(orderId))) {
    return { paid: false, transferId: null, reason: "dispute_open" }
  }

  const overrideEur = Number(order.legionOverrideAmount ?? 0)
  const overrideCents = Math.round(overrideEur * 100)
  if (overrideCents <= 0 || (order.legionPayoutStatus !== "reserved" && order.legionPayoutStatus !== "in_doubt")) {
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

  const filleulLabel = referral.referred.username ?? "filleul"
  const sponsorUserId = referral.sponsor.user.id

  // Recording the paid override: the order's Légion status, the referral's running total (once) and the ledger row.
  // Runs in the SAME transaction as the leg turning PAID (or, for a leg paid earlier, on its own, idempotently).
  const recordOverridePaid = async (tx: Prisma.TransactionClient, transferId: string) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, legionPayoutStatus: { in: ["reserved", "in_doubt"] } },
      data: { legionPayoutStatus: "paid_24h" },
    })
    if (claimed.count === 1) {
      await tx.legionReferral.updateMany({
        where: { referredId: order.storeProfileId!, status: "active" },
        data: { totalOverrideEarned: { increment: overrideEur } },
      })
    }
    await insertPayoutLedgerRow(tx, {
      orderId,
      blindDropshipOrderId: null,
      userId: sponsorUserId,
      beneficiaryRole: "LEGION_SPONSOR",
      entryType: "LEGION_OVERRIDE",
      amountCents: overrideCents,
      idempotencyKey: `legion_override_${orderId}`,
      stripeTransferId: transferId,
      payoutRail: "connect",
      note: `Légion 2% override from @${filleulLabel}`,
    })
  }

  // The override is one leg of the order (order × LEGION_SPONSOR) in the payout leg registry: claimed before Stripe,
  // searched in Stripe before any creation, one idempotency key per generation (docs/PAYOUT-LEG-REGISTRY.md).
  const leg = await executeLegTransfer({
    legKey: orderLegKey(orderId, "LEGION_SPONSOR"),
    kind: "order",
    role: "LEGION_SPONSOR",
    rail: "legion",
    orderId,
    transferGroup: orderId,
    params: {
      amountCents: overrideCents,
      currency: "eur",
      destination,
      sourceTransaction: order.stripeChargeId ?? null,
    },
    description: `Légion override 2% — filleul @${filleulLabel}`,
    extraMetadata: {
      order_id: orderId,
      role: "sponsor",
      rail: "legion_phase1",
      override_eur: String(overrideEur),
      sponsor_id: referral.sponsorId,
    },
    onPaid: (tx, paid) => recordOverridePaid(tx, paid.stripeTransferId),
  })

  if (leg.outcome === "paid") {
    console.log("[legion]", {
      result: "override_paid",
      orderId,
      transferId: leg.stripeTransferId,
      overrideCents,
      sponsorId: referral.sponsorId,
    })
    return { paid: true, transferId: leg.stripeTransferId }
  }
  if (leg.outcome === "already_paid") {
    if (leg.amountCents) {
      await prisma.$transaction((tx) => recordOverridePaid(tx, leg.stripeTransferId))
    } else {
      // Adopted from records written before the registry: mark the order paid, write nothing new about money.
      await prisma.order.updateMany({
        where: { id: orderId, legionPayoutStatus: { in: ["reserved", "in_doubt"] } },
        data: { legionPayoutStatus: "paid_24h" },
      })
    }
    return { paid: true, transferId: leg.stripeTransferId, reason: "already_paid" }
  }

  // Not paid. `in_doubt` = a transfer MAY exist: never retried automatically (the catch-up re-asks the registry, which
  // only answers paid once a reconciliation adopted it). `failed` = Stripe refused or a person confirmed nothing was
  // paid — no automatic retry either (founder decision on the 2% slice). Anything that created nothing for sure and may
  // succeed later (busy, Stripe search incomplete, rate limit, registry unavailable) keeps the order `reserved`.
  const nextStatus =
    leg.outcome === "in_doubt"
      ? "in_doubt"
      : leg.outcome === "failed_confirmed" || leg.outcome === "params_changed" || leg.outcome === "invalid_params"
        ? "failed"
        : null
  console.error("[legion]", { result: "override_not_paid", orderId, outcome: leg.outcome, nextStatus })
  if (nextStatus) {
    await prisma.order.updateMany({
      where: { id: orderId, legionPayoutStatus: { in: ["reserved", "in_doubt"] } },
      data: { legionPayoutStatus: nextStatus },
    })
  }
  return { paid: false, transferId: null, reason: leg.outcome }
}

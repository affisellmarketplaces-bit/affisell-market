import type { Prisma, TransferRole } from "@prisma/client"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import {
  beneficiaryUserIdForRole,
  clawbackLedgerIdempotencyKey,
  ledgerIdempotencyKeyForStripeTransfer,
  legacyLedgerIdempotencyKey,
  payoutTimestampFieldForRole,
  type PayoutRail,
} from "@/lib/payout-settlement.shared"
import { recordMerchantPayoutEntry } from "@/lib/payout-ledger"
import { prisma } from "@/lib/prisma"

type Tx = Prisma.TransactionClient

export type RecordStripePayoutSettlementArgs = {
  orderId: string
  beneficiaryRole: "SUPPLIER" | "AFFILIATE"
  userId: string
  amountCents: number
  stripeTransferId: string
  payoutRail: Extract<PayoutRail, "connect" | "lightning">
  productName?: string | null
  paidAt?: Date
}

/**
 * Canonical post-Stripe settlement: immutable ledger mirror + order timestamps + inbox alert.
 * Idempotent on stripeTransferId — safe to call from webhook retries or transfer job replays.
 */
export async function recordStripePayoutSettlement(
  tx: Tx,
  args: RecordStripePayoutSettlementArgs
): Promise<boolean> {
  const amountCents = Math.round(args.amountCents)
  const transferId = args.stripeTransferId.trim()
  if (amountCents < 1 || !transferId) return false

  const paidAt = args.paidAt ?? new Date()
  const productLabel = args.productName?.trim() || "order"
  const railLabel = args.payoutRail === "lightning" ? "Lightning" : "Connect"

  const recorded = await recordMerchantPayoutEntry(tx, {
    orderId: args.orderId,
    userId: args.userId,
    beneficiaryRole: args.beneficiaryRole,
    amountCents,
    stripeTransferId: transferId,
    payoutRail: args.payoutRail,
    idempotencyKey: ledgerIdempotencyKeyForStripeTransfer(transferId),
    note: `${railLabel} payout · ${productLabel} · ${transferId}`,
    entryType: "PAYOUT",
  })
  if (!recorded) return false

  const tsField = payoutTimestampFieldForRole(args.beneficiaryRole)
  await tx.order.update({
    where: { id: args.orderId },
    data: { [tsField]: paidAt },
  })

  const message =
    args.beneficiaryRole === "SUPPLIER"
      ? `Payout released · ${productLabel} · ${formatStoreCurrencyFromCents(amountCents)} (wholesale via ${railLabel}). Buyers may still return within the legal window — refunds remain mandatory if approved.`
      : `Payout released · ${productLabel} · ${formatStoreCurrencyFromCents(amountCents)} via ${railLabel}. If the buyer returns and is refunded later, you must reimburse your share.`

  await tx.notification.create({
    data: {
      userId: args.userId,
      type: "PAYOUT_SENT",
      message,
      orderId: args.orderId,
    },
  })

  console.log("[payout-settlement]", {
    orderId: args.orderId,
    role: args.beneficiaryRole,
    amountCents,
    stripeTransferId: transferId,
    payoutRail: args.payoutRail,
    result: "recorded",
  })

  return true
}

/** True when a role was already settled via Stripe transfer or legacy ledger-only cron. */
export async function marketplaceRoleAlreadySettled(
  orderId: string,
  role: "SUPPLIER" | "AFFILIATE"
): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      supplierPayoutAt: true,
      affiliatePayoutAt: true,
      payoutStatus: true,
      transferAttempts: {
        where: { role },
        select: { status: true, stripeTransferId: true },
      },
    },
  })
  if (!order) return false

  if (order.payoutStatus === "PAID") return true

  const tsField = payoutTimestampFieldForRole(role)
  if (order[tsField] != null) return true

  const attempt = order.transferAttempts[0]
  if (attempt?.status === "SUCCESS" && attempt.stripeTransferId) return true

  const legacyKey = legacyLedgerIdempotencyKey(role, orderId)
  const legacy = await prisma.merchantPayoutLedger.findUnique({
    where: { idempotencyKey: legacyKey },
    select: { id: true },
  })
  return legacy != null
}

/**
 * Block Connect transfer when pre-unification cron already wrote a ledger obligation
 * without a matching Stripe transfer (prevents double payout on legacy rows).
 */
export async function resolveLegacyLedgerBlockReason(
  orderId: string,
  role: TransferRole
): Promise<string | null> {
  const beneficiaryRole = role as "SUPPLIER" | "AFFILIATE"
  const legacyKey = legacyLedgerIdempotencyKey(beneficiaryRole, orderId)
  const legacy = await prisma.merchantPayoutLedger.findUnique({
    where: { idempotencyKey: legacyKey },
    select: { stripeTransferId: true },
  })
  if (!legacy) return null
  if (legacy.stripeTransferId) return null
  return "LEGACY_LEDGER_WITHOUT_STRIPE"
}

/** Mark pending attempts superseded when Lightning or legacy ledger already paid. */
export async function supersedePendingTransferAttempt(
  tx: Tx,
  orderId: string,
  role: TransferRole,
  reason: string
): Promise<void> {
  await tx.transferAttempt.updateMany({
    where: { orderId, role, status: "PENDING" },
    data: {
      status: "FAILED",
      errorCode: reason,
      errorMessage: `Transfer skipped: ${reason}`,
      lastAttemptAt: new Date(),
    },
  })
}

export type ClawbackStripePayoutArgs = {
  orderId: string
  beneficiaryRole: "SUPPLIER" | "AFFILIATE"
  userId: string
  amountCents: number
  productName: string
}

/** Clawback only when money actually moved (ledger with stripeTransferId or legacy paid timestamp). */
export async function recordClawbackIfPaidOut(
  tx: Tx,
  args: ClawbackStripePayoutArgs
): Promise<boolean> {
  const amountCents = Math.round(args.amountCents)
  if (amountCents < 1) return false

  const key = clawbackLedgerIdempotencyKey(args.beneficiaryRole, args.orderId)
  try {
    await recordMerchantPayoutEntry(tx, {
      orderId: args.orderId,
      userId: args.userId,
      beneficiaryRole: args.beneficiaryRole,
      amountCents,
      payoutRail: "ledger_only",
      idempotencyKey: key,
      note: `Mandatory refund clawback · ${args.productName}`,
      entryType: "CLAWBACK",
    })
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return false
    throw e
  }

  const message =
    args.beneficiaryRole === "SUPPLIER"
      ? `Refund obligation · ${args.productName} · reimburse ${formatStoreCurrencyFromCents(amountCents)} (payout was already released; buyer refund is mandatory).`
      : `Refund obligation · ${args.productName} · reimburse ${formatStoreCurrencyFromCents(amountCents)} (earnings were paid out; buyer refund must be honored).`

  await tx.notification.create({
    data: {
      userId: args.userId,
      type: "PAYOUT_CLAWBACK",
      message,
      orderId: args.orderId,
    },
  })

  console.log("[payout-settlement]", {
    orderId: args.orderId,
    role: args.beneficiaryRole,
    amountCents,
    result: "clawback",
  })

  return true
}

export async function loadOrderClawbackContext(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      supplierId: true,
      affiliateId: true,
      supplierPayoutAt: true,
      affiliatePayoutAt: true,
      supplierPayoutCents: true,
      affiliatePayoutCents: true,
      affiliateMarginRetainedCents: true,
      affiliateFeeCents: true,
      affiliateMarginCents: true,
      basePriceCents: true,
      supplierPriceCents: true,
      supplierCommissionRateBps: true,
      supplierFeeCents: true,
      usesAffisellAutoBuy: true,
      aeWholesaleCents: true,
      payoutStatus: true,
      transferAttempts: {
        where: { status: "SUCCESS" },
        select: { role: true, amountCents: true, stripeTransferId: true },
      },
      merchantPayoutLedger: {
        where: { entryType: "PAYOUT" },
        select: {
          beneficiaryRole: true,
          amountCents: true,
          stripeTransferId: true,
          idempotencyKey: true,
        },
      },
      product: { select: { name: true } },
    },
  })
}

export function resolvedClawbackAmountCents(
  role: "SUPPLIER" | "AFFILIATE",
  order: NonNullable<Awaited<ReturnType<typeof loadOrderClawbackContext>>>
): number {
  const attempt = order.transferAttempts.find((a) => a.role === role)
  if (attempt && attempt.amountCents > 0) return attempt.amountCents

  const ledgerStripe = order.merchantPayoutLedger.find(
    (e) => e.beneficiaryRole === role && e.stripeTransferId
  )
  if (ledgerStripe) return ledgerStripe.amountCents

  const legacyKey = legacyLedgerIdempotencyKey(role, order.id)
  const legacy = order.merchantPayoutLedger.find((e) => e.idempotencyKey === legacyKey)
  if (legacy) return legacy.amountCents

  if (role === "SUPPLIER") {
    return order.supplierPayoutCents > 0 ? order.supplierPayoutCents : 0
  }

  return netAffiliateTransferCents({
    affiliatePayoutCents: order.affiliatePayoutCents,
    affiliateMarginRetainedCents: order.affiliateMarginRetainedCents,
    affiliateFeeCents: order.affiliateFeeCents,
    affiliateMarginCents: order.affiliateMarginCents,
  })
}

export function roleWasPaidOut(
  role: "SUPPLIER" | "AFFILIATE",
  order: NonNullable<Awaited<ReturnType<typeof loadOrderClawbackContext>>>
): boolean {
  if (order.payoutStatus === "PAID") return true
  const tsField = payoutTimestampFieldForRole(role)
  if (order[tsField] != null) return true
  if (order.transferAttempts.some((a) => a.role === role)) return true
  const legacyKey = legacyLedgerIdempotencyKey(role, order.id)
  return order.merchantPayoutLedger.some((e) => e.idempotencyKey === legacyKey)
}

export { beneficiaryUserIdForRole }

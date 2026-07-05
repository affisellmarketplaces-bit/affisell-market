import type { Prisma, TransferRole } from "@prisma/client"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import {
  beneficiaryUserIdForRole,
  clawbackLedgerIdempotencyKey,
  isLedgerPayoutRealized,
  legacyLedgerIdempotencyKey,
  ledgerIdempotencyKeyForStripeTransfer,
  netClawbackCentsForRole,
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

/** True when Stripe money actually moved for this role (not phantom ledger / payoutAt alone). */
export async function marketplaceRoleAlreadySettled(
  orderId: string,
  role: "SUPPLIER" | "AFFILIATE"
): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      payoutStatus: true,
      transferAttempts: {
        where: { role },
        select: { status: true, stripeTransferId: true },
      },
      merchantPayoutLedger: {
        where: {
          beneficiaryRole: role,
          entryType: "PAYOUT",
        },
        select: {
          stripeTransferId: true,
          payoutRail: true,
          blindDropshipOrderId: true,
        },
      },
    },
  })
  if (!order) return false

  if (order.payoutStatus === "PAID") return true

  const attempt = order.transferAttempts.find((a) => a.status === "SUCCESS")
  if (attempt?.stripeTransferId?.trim()) return true

  return order.merchantPayoutLedger.some((e) => isLedgerPayoutRealized(e))
}

/**
 * @deprecated Phantom ledger no longer blocks Connect after marketplaceRoleAlreadySettled fix.
 * Kept for observability logging only.
 */
export async function resolveLegacyLedgerBlockReason(
  orderId: string,
  role: TransferRole
): Promise<string | null> {
  const beneficiaryRole = role as "SUPPLIER" | "AFFILIATE"
  const legacyKey = legacyLedgerIdempotencyKey(beneficiaryRole, orderId)
  const legacy = await prisma.merchantPayoutLedger.findUnique({
    where: { idempotencyKey: legacyKey },
    select: { stripeTransferId: true, payoutRail: true },
  })
  if (!legacy) return null
  if (legacy.stripeTransferId?.trim()) return null
  if (legacy.payoutRail === "phantom_legacy") return null
  return "LEGACY_LEDGER_UNMARKED"
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
  idempotencyKey?: string
  note?: string
}

/** Sum CLAWBACK ledger entries for a beneficiary role (excludes phantom_legacy). */
export function netClawbackCentsForRole(
  rows: Array<{ beneficiaryRole: string; entryType: string; amountCents: number; payoutRail?: string | null }>,
  role: "SUPPLIER" | "AFFILIATE"
): number {
  let net = 0
  for (const row of rows) {
    if (row.beneficiaryRole !== role) continue
    if (row.payoutRail === "phantom_legacy") continue
    if (row.entryType === "CLAWBACK") net += row.amountCents
  }
  return net
}

/** Clawback only when money actually moved (ledger with stripeTransferId or legacy paid timestamp). */
export async function recordClawbackIfPaidOut(
  tx: Tx,
  args: ClawbackStripePayoutArgs
): Promise<boolean> {
  const amountCents = Math.round(args.amountCents)
  if (amountCents < 1) return false

  const key =
    args.idempotencyKey?.trim() ||
    clawbackLedgerIdempotencyKey(args.beneficiaryRole, args.orderId)
  const note =
    args.note?.trim() ||
    `Mandatory refund clawback · ${args.productName}`

  try {
    await recordMerchantPayoutEntry(tx, {
      orderId: args.orderId,
      userId: args.userId,
      beneficiaryRole: args.beneficiaryRole,
      amountCents,
      payoutRail: "ledger_only",
      idempotencyKey: key,
      note,
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
    idempotencyKey: key,
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
        select: {
          beneficiaryRole: true,
          amountCents: true,
          entryType: true,
          stripeTransferId: true,
          idempotencyKey: true,
          payoutRail: true,
          blindDropshipOrderId: true,
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
  if (legacy && isLedgerPayoutRealized(legacy)) return legacy.amountCents

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

  const attempt = order.transferAttempts.find(
    (a) => a.role === role && a.stripeTransferId?.trim()
  )
  if (attempt) return true

  return order.merchantPayoutLedger.some(
    (e) => e.beneficiaryRole === role && isLedgerPayoutRealized(e)
  )
}

export { beneficiaryUserIdForRole }

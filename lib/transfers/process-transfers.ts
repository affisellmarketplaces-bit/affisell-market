import type { Prisma, TransferRole } from "@prisma/client"
import Stripe from "stripe"

import {
  checkTransferBudget,
  moneyGuardMode,
  orderChargedTotalCents,
  orderTransferCeilingCents,
  PAYOUT_EXCEEDS_LINE_ERROR,
} from "@/lib/money/split-guard"
import { evaluateTransferReleaseForRole } from "@/lib/order-transfer-gating"
import { hasOpenDisputeHold } from "@/lib/orders/dispute-hold.server"
import { verifyReleaseWithStripe } from "@/lib/transfers/stripe-release-check.server"
import {
  isOrderClosedForPayout,
  isOrderPayoutHeldForDispute,
  settlementAfterTransfersSucceeded,
} from "@/lib/orders/payment-state"
import {
  matchExistingTransfer,
  payableAfterRefunds,
  type ExistingTransfer,
} from "@/lib/transfers/payable-after-refunds"
import {
  marketplaceRoleAlreadySettled,
  recordStripePayoutSettlement,
  supersedePendingTransferAttempt,
} from "@/lib/payout-settlement"
import { computeSplitStatusFromAttempts } from "@/lib/transfers/compute-split-status"
import { alertSplitTransferFailed } from "@/lib/transfers/split-slack-alert"
import { logStripeWebhookError, logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import * as Sentry from "@sentry/nextjs"

const MAX_ATTEMPTS = 3
/** A run owns an attempt for this long (far above the Stripe client's own timeouts); a crashed run's lease expires. */
export const TRANSFER_LEASE_MS = 5 * 60 * 1000

export type ProcessTransfersResult = {
  processed: number
  success: number
  failed: number
  held: number
  duration_ms: number
}

function idempotencyKey(orderId: string, role: string) {
  return `transfer_${orderId}_${role}`
}

async function syncOnboardingFailure(accountId: string) {
  const stripe = getStripeClient()
  const account = await stripe.accounts.retrieve(accountId)
  await prisma.user.updateMany({
    where: { stripeAccountId: accountId },
    data: {
      stripeOnboardedAt: null,
      stripeCapabilities: account.capabilities as Prisma.InputJsonValue,
    },
  })
}

async function applyOrderSettlement(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      transferAttempts: true,
      product: { select: { name: true } },
    },
  })
  if (!order) return

  const splitStatus = computeSplitStatusFromAttempts(order.transferAttempts)
  const supplierAttempt = order.transferAttempts.find((a) => a.role === "SUPPLIER")
  const affiliateAttempt = order.transferAttempts.find((a) => a.role === "AFFILIATE")

  const data: Prisma.OrderUpdateInput = { splitStatus }

  if (supplierAttempt?.status === "SUCCESS") {
    data.supplierPayoutCents = supplierAttempt.amountCents
    data.stripeTransferId = supplierAttempt.stripeTransferId
    if (!order.supplierPayoutAt && supplierAttempt.lastAttemptAt) {
      data.supplierPayoutAt = supplierAttempt.lastAttemptAt
    }
  }
  if (affiliateAttempt?.status === "SUCCESS") {
    data.affiliatePayoutCents = affiliateAttempt.amountCents
    if (!order.affiliatePayoutAt && affiliateAttempt.lastAttemptAt) {
      data.affiliatePayoutAt = affiliateAttempt.lastAttemptAt
    }
  }
  if (splitStatus === "SUCCESS") {
    // Never overwrite a refund state with SETTLED (a charge refunded after the payouts left is owned by the clawback pipeline).
    data.paymentSettlementStatus = settlementAfterTransfersSucceeded(order.paymentSettlementStatus)
    if (order.payoutStatus === "PENDING") {
      data.payoutStatus = "PAID"
    }
    const destinations = order.transferAttempts
      .map((a) => a.destination)
      .filter(Boolean)
    if (destinations.length > 0) {
      await prisma.user.updateMany({
        where: { stripeAccountId: { in: destinations } },
        data: { stripeOnboardedAt: new Date() },
      })
    }
  }

  await prisma.order.update({ where: { id: orderId }, data })

  logStripeWebhookInfo({
    level: "info",
    metric: "webhook_checkout_completed",
    orderId,
    supplierTransferId: supplierAttempt?.stripeTransferId ?? null,
    affiliateTransferId: affiliateAttempt?.stripeTransferId ?? null,
    splitStatus,
  })
}

async function notifyTerminalFailure(args: {
  orderId: string
  role: TransferRole
  errorCode: string | null
  attempts: number
  status: string
}) {
  if (args.status !== "FAILED" || args.attempts < MAX_ATTEMPTS) return
  await alertSplitTransferFailed({
    orderId: args.orderId,
    role: args.role,
    errorCode: args.errorCode,
    attempts: args.attempts,
  })
}

/** Never throws: a failure here is alerted and left to the reconciliation, the transfer itself already happened. */
async function clawBackRefundsDuringTransfer(orderId: string, role: string, seenRefundIds: ReadonlySet<string>) {
  try {
    const after = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        paymentSettlementStatus: true,
        totalCents: true,
        subtotalCents: true,
        sellingPriceCents: true,
        taxCents: true,
        stripeRefunds: { select: { stripeRefundId: true, amountCents: true } },
      },
    })
    const late = (after?.stripeRefunds ?? []).filter((r) => !seenRefundIds.has(r.stripeRefundId))
    if (!after || late.length === 0) return
    logStripeWebhookError({
      level: "error",
      metric: "refund_during_transfer",
      orderId,
      role,
      amount: late.reduce((n, r) => n + r.amountCents, 0),
    })
    const { clawbackOrderPayoutsOnPartialRefund, clawbackOrderPayoutsOnRefund } = await import("@/lib/order-payout")
    if (isOrderClosedForPayout(after)) {
      await clawbackOrderPayoutsOnRefund(orderId)
      return
    }
    const total = orderChargedTotalCents(after)
    for (const r of late) {
      await clawbackOrderPayoutsOnPartialRefund(orderId, {
        stripeRefundId: r.stripeRefundId,
        refundAmountCents: r.amountCents,
        orderTotalCents: total,
      })
    }
  } catch (err) {
    logStripeWebhookError({
      level: "error",
      metric: "refund_during_transfer_clawback_failed",
      orderId,
      role,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function processOneAttempt(
  attemptId: string
): Promise<"success" | "failed" | "skipped" | "held"> {
  const attempt = await prisma.transferAttempt.findUnique({
    where: { id: attemptId },
    include: {
      order: {
        include: {
          product: { select: { name: true } },
          returns: { select: { status: true } },
          autoBuyLog: { select: { status: true } },
          supplierFulfillmentLinks: {
            select: {
              supplierFulfillmentOrder: { select: { status: true } },
            },
          },
        },
      },
    },
  })
  if (!attempt || attempt.status !== "PENDING" || attempt.attempts >= MAX_ATTEMPTS) {
    return "skipped"
  }

  if (attempt.order.payoutStatus === "PAID") {
    console.log("[transfer-gating]", {
      orderId: attempt.orderId,
      role: attempt.role,
      reason: "already_paid_via_lightning",
    })
    return "skipped"
  }

  // A refunded / cancelled order must not release a transfer: cancel the pending attempt instead of paying out of a
  // charge that went back to the buyer (finalisation master doc, D1/D3).
  if (isOrderClosedForPayout(attempt.order)) {
    console.log("[transfer-gating]", {
      orderId: attempt.orderId,
      role: attempt.role,
      reason: "order_closed",
      status: attempt.order.status,
      settlementStatus: attempt.order.paymentSettlementStatus,
    })
    await prisma.$transaction(async (tx) => {
      await supersedePendingTransferAttempt(tx, attempt.orderId, attempt.role, "ORDER_CLOSED")
    })
    return "skipped"
  }

  // A dispute (chargeback) is open on the charge: the buyer's bank already pulled the money from the platform balance, so
  // nothing may be released until it is decided. The attempt stays PENDING (not cancelled, attempts not consumed): it is
  // released after a won dispute and superseded as ORDER_CLOSED after a lost one (finalisation master doc, D7). The ledger
  // is asked, not only `Order.status`: another writer can overwrite "disputed" with "shipped" while the dispute is open.
  if (isOrderPayoutHeldForDispute(attempt.order, await hasOpenDisputeHold(attempt.orderId))) {
    console.log("[transfer-gating]", {
      orderId: attempt.orderId,
      role: attempt.role,
      reason: "dispute_open",
      status: attempt.order.status,
    })
    return "held"
  }

  const beneficiaryRole = attempt.role as "SUPPLIER" | "AFFILIATE"
  if (await marketplaceRoleAlreadySettled(attempt.orderId, beneficiaryRole)) {
    await prisma.$transaction(async (tx) => {
      await supersedePendingTransferAttempt(tx, attempt.orderId, attempt.role, "ALREADY_SETTLED")
    })
    await applyOrderSettlement(attempt.orderId)
    return "skipped"
  }

  const gate = evaluateTransferReleaseForRole(attempt.role, {
    status: attempt.order.status,
    usesAffisellAutoBuy: attempt.order.usesAffisellAutoBuy,
    shippedAt: attempt.order.shippedAt,
    trackingNumber: attempt.order.trackingNumber,
    deliveredAt: attempt.order.deliveredAt,
    deliveryConfirmedAt: attempt.order.deliveryConfirmedAt,
    deliveryConfirmedBy: attempt.order.deliveryConfirmedBy,
    payoutEligibleAt: attempt.order.payoutEligibleAt,
    fulfillmentStatus: attempt.order.fulfillmentStatus,
    autoBuyLogStatus: attempt.order.autoBuyLog?.status ?? null,
    supplierJobStatuses: attempt.order.supplierFulfillmentLinks.map(
      (l) => l.supplierFulfillmentOrder.status
    ),
    returns: attempt.order.returns,
  })

  if (!gate.eligible) {
    console.log("[transfer-gating]", {
      orderId: attempt.orderId,
      role: attempt.role,
      phase: gate.phase,
      reason: gate.reason,
    })
    return "held"
  }

  // ── Claim the attempt (one run at a time) ────────────────────────────────────────────────────────────────────
  // The cron and the webhook-triggered release can run the same attempt at once. Both would call Stripe (the shared
  // idempotency key prevents a second transfer only if both requests are IDENTICAL), and the loser's error path could
  // overwrite a SUCCESS. A conditional update takes a short lease on the row: only the run whose update matches goes on.
  // Attempts are not consumed (a held attempt must stay retryable); the lease expires by itself.
  const leaseNow = new Date()
  const claimed = await prisma.transferAttempt.updateMany({
    where: {
      id: attempt.id,
      status: "PENDING",
      OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: new Date(leaseNow.getTime() - TRANSFER_LEASE_MS) } }],
    },
    data: { lastAttemptAt: leaseNow },
  })
  if (claimed.count !== 1) {
    console.log("[transfer-gating]", { orderId: attempt.orderId, role: attempt.role, reason: "claimed_by_another_run" })
    return "skipped"
  }

  const stripe = getStripeClient()
  const now = new Date()
  const nextAttempts = attempt.attempts + 1

  try {
    const account = await stripe.accounts.retrieve(attempt.destination)
    if (account.capabilities?.transfers !== "active") {
      await prisma.transferAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "FAILED",
          errorCode: "AFFILIATE_ONBOARDING_REQUIRED",
          errorMessage: `transfers not active for ${attempt.destination}`,
          attempts: nextAttempts,
          lastAttemptAt: now,
        },
      })
      await syncOnboardingFailure(attempt.destination)
      await notifyTerminalFailure({
        orderId: attempt.orderId,
        role: attempt.role,
        errorCode: "AFFILIATE_ONBOARDING_REQUIRED",
        attempts: nextAttempts,
        status: "FAILED",
      })
      await applyOrderSettlement(attempt.orderId)
      return "failed"
    }

    // Last line of defence before money leaves: total paid + this transfer ≤ line HT.
    const alreadyPaid = await prisma.transferAttempt.findMany({
      where: { orderId: attempt.orderId, status: "SUCCESS", NOT: { id: attempt.id } },
      select: { amountCents: true },
    })
    const budget = checkTransferBudget({
      lineHtCents: orderTransferCeilingCents(attempt.order),
      transferCents: [attempt.amountCents],
      alreadyPaidCents: alreadyPaid.reduce((s, a) => s + a.amountCents, 0),
    })
    if (!budget.ok) {
      logStripeWebhookError({
        level: "error",
        metric: "transfer_blocked_exceeds_line",
        orderId: attempt.orderId,
        role: attempt.role,
        amount: attempt.amountCents,
        excessCents: budget.excessCents,
        mode: moneyGuardMode(),
      })
      if (moneyGuardMode() === "enforce") {
        await prisma.transferAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "FAILED",
            errorCode: PAYOUT_EXCEEDS_LINE_ERROR,
            errorMessage: `Transfer would exceed the line total by ${budget.excessCents} cents`,
            attempts: MAX_ATTEMPTS,
            lastAttemptAt: now,
          },
        })
        await notifyTerminalFailure({
          orderId: attempt.orderId,
          role: attempt.role,
          errorCode: PAYOUT_EXCEEDS_LINE_ERROR,
          attempts: MAX_ATTEMPTS,
          status: "FAILED",
        })
        await applyOrderSettlement(attempt.orderId)
        return "failed"
      }
    }

    // ── Last read before money leaves ──────────────────────────────────────────────────────────────────────────
    // The attempt and its order were read at the start of this run, BEFORE the Stripe account call: a refund, a
    // cancellation or a Lightning payout may have landed since. Re-read the order and its refunds now, as late as
    // possible, and pay only what is still owed.
    const fresh = await prisma.order.findUnique({
      where: { id: attempt.orderId },
      select: {
        status: true,
        paymentSettlementStatus: true,
        payoutStatus: true,
        totalCents: true,
        subtotalCents: true,
        sellingPriceCents: true,
        taxCents: true,
        currency: true,
        stripeChargeId: true,
        stripePaymentIntentId: true,
        stripeSessionId: true,
        stripeRefunds: { select: { stripeRefundId: true, amountCents: true } },
      },
    })
    if (!fresh) return "held"
    if (fresh.payoutStatus === "PAID" || fresh.payoutStatus === "PROCESSING") {
      console.log("[transfer-gating]", { orderId: attempt.orderId, role: attempt.role, reason: "lightning_at_release" })
      return "skipped"
    }
    if (isOrderClosedForPayout(fresh)) {
      console.log("[transfer-gating]", { orderId: attempt.orderId, role: attempt.role, reason: "order_closed_at_release" })
      await prisma.$transaction(async (tx) => {
        await supersedePendingTransferAttempt(tx, attempt.orderId, attempt.role, "ORDER_CLOSED")
      })
      return "skipped"
    }
    // A dispute opened since the attempt was loaded (D7): held, attempt kept PENDING.
    if (isOrderPayoutHeldForDispute(fresh, await hasOpenDisputeHold(attempt.orderId))) {
      console.log("[transfer-gating]", { orderId: attempt.orderId, role: attempt.role, reason: "dispute_open_at_release" })
      return "held"
    }

    // ── Stripe itself must agree with our rows (a refund whose webhook never arrived, a dispute we did not record) ──
    const stripeCheck = await verifyReleaseWithStripe(
      stripe,
      { id: attempt.orderId, ...fresh },
      fresh.stripeRefunds,
    )
    if (!stripeCheck.ok) {
      logStripeWebhookError({
        level: "error",
        metric: "transfer_held_stripe_check",
        orderId: attempt.orderId,
        role: attempt.role,
        reason: stripeCheck.reason,
        detail: stripeCheck.detail,
      })
      // Explainable trace on the attempt itself; it stays PENDING and its attempts are not consumed.
      await prisma.transferAttempt.update({
        where: { id: attempt.id },
        data: {
          errorCode: `STRIPE_CHECK_${stripeCheck.reason.toUpperCase()}`,
          errorMessage: stripeCheck.detail.slice(0, 500),
        },
      })
      return "held"
    }

    const refundsAtRelease = fresh.stripeRefunds
    const { payableCents, refundShareCents } = payableAfterRefunds({
      scheduledCents: attempt.amountCents,
      refundCents: refundsAtRelease.map((r) => r.amountCents),
      orderChargedTotalCents: orderChargedTotalCents(fresh),
    })
    if (payableCents < 1) {
      await prisma.$transaction(async (tx) => {
        await supersedePendingTransferAttempt(tx, attempt.orderId, attempt.role, "REFUNDED_SHARE")
      })
      return "skipped"
    }

    // ── A transfer this attempt already created? (crash between the Stripe call and its record) ────────────────
    // The idempotency key protects a replay for ~24 h only; after that a second call would pay twice. Stripe's list
    // is searched first; if the search itself fails, nothing is created (held, retried on the next run).
    let existing: ExistingTransfer | null
    try {
      const page = await stripe.transfers.list({ transfer_group: attempt.orderId, limit: 100 })
      existing = matchExistingTransfer(page.data, { role: attempt.role, destination: attempt.destination })
    } catch (searchErr) {
      logStripeWebhookError({
        level: "error",
        metric: "transfer_search_failed",
        orderId: attempt.orderId,
        role: attempt.role,
        error: searchErr instanceof Error ? searchErr.message : String(searchErr),
      })
      return "held"
    }
    if (existing && existing.amount > payableCents) {
      // Money already left above what is owed now (a refund landed after the lost call): record the truth, alert.
      logStripeWebhookError({
        level: "error",
        metric: "adopted_transfer_exceeds_payable",
        orderId: attempt.orderId,
        role: attempt.role,
        amount: existing.amount,
        excessCents: existing.amount - payableCents,
      })
    }

    const sourceTransaction = attempt.order.stripeChargeId ?? undefined
    const transfer = existing
      ? { id: existing.id, amount: existing.amount }
      : await stripe.transfers.create(
          {
            amount: payableCents,
            currency: "eur",
            destination: attempt.destination,
            transfer_group: attempt.orderId,
            ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
            metadata: {
              orderId: attempt.orderId,
              role: attempt.role,
              scheduledCents: String(attempt.amountCents),
              refundShareCents: String(refundShareCents),
              stripeCheckedRefundCents: String(stripeCheck.stripeRefundCents),
            },
          },
          { idempotencyKey: idempotencyKey(attempt.orderId, attempt.role) },
        )
    const transferredCents = existing ? existing.amount : payableCents

    const paidAt = new Date()
    const beneficiaryRole = attempt.role as "SUPPLIER" | "AFFILIATE"
    const userId =
      beneficiaryRole === "SUPPLIER" ? attempt.order.supplierId : attempt.order.affiliateId

    await prisma.$transaction(async (tx) => {
      await tx.transferAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUCCESS",
          stripeTransferId: transfer.id,
          errorCode: null,
          errorMessage: null,
          attempts: nextAttempts,
          lastAttemptAt: paidAt,
        },
      })

      await recordStripePayoutSettlement(tx, {
        orderId: attempt.orderId,
        beneficiaryRole,
        userId,
        // What really moved (after refunds), not the scheduled share: the ledger explains every cent.
        amountCents: transferredCents,
        stripeTransferId: transfer.id,
        payoutRail: "connect",
        productName: attempt.order.product?.name ?? null,
        paidAt,
      })
    })

    // ── A refund that landed WHILE the transfer was in flight ────────────────────────────────────────────────────
    // Its webhook ran when this role was not yet recorded as paid, so its clawback found nothing to take back. Now that
    // the transfer is recorded, apply that clawback (same functions, idempotent ledger keys per refund).
    await clawBackRefundsDuringTransfer(attempt.orderId, attempt.role, new Set(refundsAtRelease.map((r) => r.stripeRefundId)))

    logStripeWebhookInfo({
      level: "info",
      metric: "transfer_created",
      orderId: attempt.orderId,
      role: attempt.role,
      amount: attempt.amountCents,
      destination: attempt.destination,
      id: transfer.id,
    })

    await applyOrderSettlement(attempt.orderId)

    if (attempt.role === "AFFILIATE") {
      try {
        const { payLegionOverrideForOrder } = await import("@/lib/legion/pay-referral-override")
        await payLegionOverrideForOrder(attempt.orderId)
      } catch (legionPayErr) {
        console.error("[legion]", {
          result: "override_pay_hook_failed",
          orderId: attempt.orderId,
          error: legionPayErr instanceof Error ? legionPayErr.message : String(legionPayErr),
        })
      }
    }

    return "success"
  } catch (error) {
    let errorCode: string | null = null
    let errorMessage = error instanceof Error ? error.message : String(error)

    if (error instanceof Stripe.errors.StripeError) {
      errorCode = error.code ?? error.type
      errorMessage = error.message
      if (error.code === "insufficient_capabilities_for_transfer") {
        errorCode = "AFFILIATE_ONBOARDING_REQUIRED"
        await syncOnboardingFailure(attempt.destination)
      }
    } else if (errorMessage.startsWith("AFFILIATE_ONBOARDING_REQUIRED:")) {
      errorCode = "AFFILIATE_ONBOARDING_REQUIRED"
      await syncOnboardingFailure(attempt.destination)
    }

    const terminal = nextAttempts >= MAX_ATTEMPTS

    await prisma.transferAttempt.update({
      where: { id: attempt.id },
      data: {
        status: terminal ? "FAILED" : "PENDING",
        errorCode,
        errorMessage,
        attempts: nextAttempts,
        lastAttemptAt: now,
      },
    })

    logStripeWebhookError({
      level: "error",
      metric: "transfer_attempt_failed",
      orderId: attempt.orderId,
      role: attempt.role,
      errorCode,
      accountId: attempt.destination,
      attempts: nextAttempts,
    })

    await notifyTerminalFailure({
      orderId: attempt.orderId,
      role: attempt.role,
      errorCode,
      attempts: nextAttempts,
      status: terminal ? "FAILED" : "PENDING",
    })

    await applyOrderSettlement(attempt.orderId)
    return "failed"
  }
}

export async function runProcessTransfersJob(options?: {
  metric?: string
  orderId?: string
}): Promise<ProcessTransfersResult> {
  const started = Date.now()
  const metric = options?.metric ?? "transfer_job_run"

  const pending = await prisma.transferAttempt.findMany({
    where: {
      status: "PENDING",
      attempts: { lt: MAX_ATTEMPTS },
      ...(options?.orderId ? { orderId: options.orderId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true },
  })

  let success = 0
  let failed = 0
  let held = 0

  for (const row of pending) {
    const outcome = await processOneAttempt(row.id)
    if (outcome === "success") success += 1
    if (outcome === "failed") failed += 1
    if (outcome === "held") held += 1
  }

  // Catch-up: affiliate already settled (or zero affiliate transfer) but Légion override still reserved.
  try {
    const reserved = await prisma.order.findMany({
      where: {
        legionPayoutStatus: "reserved",
        legionOverrideAmount: { gt: 0 },
        ...(options?.orderId ? { id: options.orderId } : {}),
        OR: [
          { affiliatePayoutAt: { not: null } },
          {
            transferAttempts: {
              some: { role: "AFFILIATE", status: "SUCCESS" },
            },
          },
          { payoutStatus: "PAID" },
        ],
      },
      take: 20,
      select: { id: true },
      orderBy: { paidAt: "asc" },
    })
    const { payLegionOverrideForOrder } = await import("@/lib/legion/pay-referral-override")
    for (const row of reserved) {
      await payLegionOverrideForOrder(row.id)
    }
  } catch (catchUpErr) {
    console.error("[legion]", {
      result: "override_catchup_failed",
      error: catchUpErr instanceof Error ? catchUpErr.message : String(catchUpErr),
    })
  }

  const duration_ms = Date.now() - started
  const processed = success + failed

  logStripeWebhookInfo({
    level: "info",
    metric,
    processed,
    success,
    failed,
    held,
    duration_ms,
    orderId: options?.orderId ?? null,
  })

  if (failed > 0 && process.env.SENTRY_DSN?.trim()) {
    Sentry.captureMessage("Resettle failures", {
      level: "warning",
      extra: { failed, processed, success, held, metric },
    })
  }

  return { processed, success, failed, held, duration_ms }
}

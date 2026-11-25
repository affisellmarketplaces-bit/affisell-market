import type { Prisma, TransferRole } from "@prisma/client"
import Stripe from "stripe"

import {
  checkTransferBudget,
  moneyGuardMode,
  orderTransferCeilingCents,
  PAYOUT_EXCEEDS_LINE_ERROR,
} from "@/lib/money/split-guard"
import { evaluateTransferReleaseForRole } from "@/lib/order-transfer-gating"
import { hasOpenDisputeHold } from "@/lib/orders/dispute-hold.server"
import {
  isOrderClosedForPayout,
  isOrderPayoutHeldForDispute,
  settlementAfterTransfersSucceeded,
} from "@/lib/orders/payment-state"
import {
  marketplaceRoleAlreadySettled,
  recordStripePayoutSettlement,
  supersedePendingTransferAttempt,
} from "@/lib/payout-settlement"
import { computeSplitStatusFromAttempts } from "@/lib/transfers/compute-split-status"
import { alertSplitTransferFailed } from "@/lib/transfers/split-slack-alert"
import { logStripeWebhookError, logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import {
  ENGINE_JOB_ATTRIBUTION_SELECT,
  jobAttributionOf,
  jobSupplierOrderCoversOrder,
} from "@/lib/fulfillment/engine-job-attribution"
import { orderLegKey, type LegOutcome } from "@/lib/payouts/leg-model"
import { executeLegTransfer } from "@/lib/payouts/leg-transfer.server"
import { recordMarketplaceLegPaid } from "@/lib/payouts/marketplace-leg-record"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import * as Sentry from "@sentry/nextjs"

const MAX_ATTEMPTS = 3

/** Attempt error code of a leg whose Stripe outcome is unknown: never retried automatically (docs/PAYOUT-LEG-REGISTRY.md). */
export const TRANSFER_IN_DOUBT = "TRANSFER_IN_DOUBT"

export type ProcessTransfersResult = {
  processed: number
  success: number
  failed: number
  held: number
  duration_ms: number
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

export async function applyOrderSettlement(orderId: string) {
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
              supplierFulfillmentOrder: { select: { status: true, ...ENGINE_JOB_ATTRIBUTION_SELECT } },
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
    // Only the jobs whose supplier order really covers THIS order count as "upstream funded" (an AliExpress job buys its first
    // line only: the second order of a cart must not be released on the strength of the first one's purchase).
    supplierJobStatuses: attempt.order.supplierFulfillmentLinks
      .filter((l) =>
        jobSupplierOrderCoversOrder(jobAttributionOf(l.supplierFulfillmentOrder), attempt.orderId)
      )
      .map((l) => l.supplierFulfillmentOrder.status),
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

    // Every Stripe transfer goes through the payout leg registry (claim → Stripe search → create → record), shared with
    // Lightning and Légion: one leg can be paid once, whichever rail gets there first (docs/PAYOUT-LEG-REGISTRY.md).
    const legRole = attempt.role as "SUPPLIER" | "AFFILIATE"
    const userId = legRole === "SUPPLIER" ? attempt.order.supplierId : attempt.order.affiliateId
    const productName = attempt.order.product?.name ?? null
    const leg = await executeLegTransfer({
      legKey: orderLegKey(attempt.orderId, legRole),
      kind: "order",
      role: legRole,
      rail: "process_transfers",
      orderId: attempt.orderId,
      transferGroup: attempt.orderId,
      params: {
        amountCents: attempt.amountCents,
        currency: "eur",
        destination: attempt.destination,
        sourceTransaction: attempt.order.stripeChargeId ?? null,
      },
      onPaid: (tx, paid) =>
        recordMarketplaceLegPaid(tx, {
          orderId: attempt.orderId,
          role: legRole,
          amountCents: paid.amountCents,
          destination: paid.destination,
          stripeTransferId: paid.stripeTransferId,
          paidAt: paid.paidAt,
          rail: "connect",
          userId,
          productName,
          attempts: nextAttempts,
        }),
    })

    if (leg.outcome === "already_paid" && leg.amountCents && leg.destination) {
      // Paid earlier (by this rail or by Lightning) and not yet mirrored on this attempt: record it, never pay again.
      const recordedAmount = leg.amountCents
      const recordedDestination = leg.destination
      await prisma.$transaction((tx) =>
        recordMarketplaceLegPaid(tx, {
          orderId: attempt.orderId,
          role: legRole,
          amountCents: recordedAmount,
          destination: recordedDestination,
          stripeTransferId: leg.stripeTransferId,
          paidAt: now,
          rail: "connect",
          userId,
          productName,
        })
      )
    } else if (leg.outcome === "already_paid") {
      // Adopted from records written before the registry: the attempt is settled, nothing new is written about money.
      await prisma.$transaction(async (tx) => {
        await supersedePendingTransferAttempt(tx, attempt.orderId, attempt.role, "ALREADY_SETTLED")
      })
      await applyOrderSettlement(attempt.orderId)
      return "skipped"
    } else if (leg.outcome !== "paid") {
      return handleLegNotPaid(attempt, leg, nextAttempts, now)
    }

    const transferId = leg.stripeTransferId

    logStripeWebhookInfo({
      level: "info",
      metric: "transfer_created",
      orderId: attempt.orderId,
      role: attempt.role,
      amount: attempt.amountCents,
      destination: attempt.destination,
      id: transferId,
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

type AttemptForLeg = { id: string; orderId: string; role: TransferRole; destination: string; errorCode: string | null }

/**
 * A leg that did not end paid. Only outcomes that PROVE nothing was created consume an attempt; a doubt keeps the attempt
 * PENDING (no counter consumed, no automatic retry can pay — the registry refuses) and alerts once.
 */
async function handleLegNotPaid(
  attempt: AttemptForLeg,
  leg: Exclude<LegOutcome, { outcome: "paid" | "already_paid" }>,
  nextAttempts: number,
  now: Date
): Promise<"failed" | "skipped" | "held"> {
  switch (leg.outcome) {
    case "busy":
      return "skipped"
    case "registry_unavailable":
      logStripeWebhookError({
        level: "error",
        metric: "transfer_registry_unavailable",
        orderId: attempt.orderId,
        role: attempt.role,
        reason: leg.reason,
      })
      return "held"
    case "in_doubt": {
      const firstTime = attempt.errorCode !== TRANSFER_IN_DOUBT
      await prisma.transferAttempt.update({
        where: { id: attempt.id },
        data: { errorCode: TRANSFER_IN_DOUBT, errorMessage: leg.reason, lastAttemptAt: now },
      })
      logStripeWebhookError({
        level: "error",
        metric: "transfer_in_doubt",
        orderId: attempt.orderId,
        role: attempt.role,
        reason: leg.reason,
      })
      if (firstTime) {
        await alertSplitTransferFailed({
          orderId: attempt.orderId,
          role: attempt.role,
          errorCode: TRANSFER_IN_DOUBT,
          attempts: nextAttempts,
        })
      }
      await applyOrderSettlement(attempt.orderId)
      return "held"
    }
    case "params_changed":
    case "invalid_params": {
      const errorCode = leg.outcome === "params_changed" ? "PAYOUT_PARAMS_CHANGED" : "PAYOUT_PARAMS_INVALID"
      await prisma.transferAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "FAILED",
          errorCode,
          errorMessage: leg.outcome === "invalid_params" ? leg.reason : "frozen leg parameters differ",
          attempts: MAX_ATTEMPTS,
          lastAttemptAt: now,
        },
      })
      await notifyTerminalFailure({
        orderId: attempt.orderId,
        role: attempt.role,
        errorCode,
        attempts: MAX_ATTEMPTS,
        status: "FAILED",
      })
      await applyOrderSettlement(attempt.orderId)
      return "failed"
    }
    case "failed_confirmed":
    case "retry_later": {
      let errorCode: string | null = leg.outcome === "failed_confirmed" ? leg.errorCode : leg.reason
      const errorMessage = leg.outcome === "failed_confirmed" ? leg.errorMessage : leg.reason
      if (errorCode === "insufficient_capabilities_for_transfer") {
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
        // `in_doubt` orders are re-asked too: the registry answers `in_doubt` without calling Stripe until a
        // reconciliation adopted the transfer, then the override is recorded (never paid a second time).
        legionPayoutStatus: { in: ["reserved", "in_doubt"] },
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

import type { Prisma, TransferRole } from "@prisma/client"
import Stripe from "stripe"

import { evaluateTransferReleaseForRole } from "@/lib/order-transfer-gating"
import {
  marketplaceRoleAlreadySettled,
  recordStripePayoutSettlement,
  resolveLegacyLedgerBlockReason,
  supersedePendingTransferAttempt,
} from "@/lib/payout-settlement"
import { computeSplitStatusFromAttempts } from "@/lib/transfers/compute-split-status"
import { alertSplitTransferFailed } from "@/lib/transfers/split-slack-alert"
import { logStripeWebhookError, logStripeWebhookInfo } from "@/lib/stripe-webhook-observability"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"
import * as Sentry from "@sentry/nextjs"

const MAX_ATTEMPTS = 3

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
    data.paymentSettlementStatus = "SETTLED"
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

  const beneficiaryRole = attempt.role as "SUPPLIER" | "AFFILIATE"
  if (await marketplaceRoleAlreadySettled(attempt.orderId, beneficiaryRole)) {
    await prisma.$transaction(async (tx) => {
      await supersedePendingTransferAttempt(tx, attempt.orderId, attempt.role, "ALREADY_SETTLED")
    })
    await applyOrderSettlement(attempt.orderId)
    return "skipped"
  }

  const legacyBlock = await resolveLegacyLedgerBlockReason(attempt.orderId, attempt.role)
  if (legacyBlock) {
    await prisma.$transaction(async (tx) => {
      await supersedePendingTransferAttempt(tx, attempt.orderId, attempt.role, legacyBlock)
    })
    console.log("[payout-settlement]", {
      orderId: attempt.orderId,
      role: attempt.role,
      result: "blocked_legacy_ledger",
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

    const sourceTransaction = attempt.order.stripeChargeId ?? undefined
    const transfer = await stripe.transfers.create(
      {
        amount: attempt.amountCents,
        currency: "eur",
        destination: attempt.destination,
        transfer_group: attempt.orderId,
        ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
        metadata: {
          orderId: attempt.orderId,
          role: attempt.role,
        },
      },
      { idempotencyKey: idempotencyKey(attempt.orderId, attempt.role) }
    )

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
        amountCents: attempt.amountCents,
        stripeTransferId: transfer.id,
        payoutRail: "connect",
        productName: attempt.order.product?.name ?? null,
        paidAt,
      })
    })

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

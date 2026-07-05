import type { Prisma, TransferRole } from "@prisma/client"

import {
  isLedgerPayoutRealized,
  legacyLedgerIdempotencyKey,
  payoutTimestampFieldForRole,
} from "@/lib/payout-settlement.shared"
import { prisma } from "@/lib/prisma"
import { resetOrderTransferAttempts } from "@/lib/transfers/reset-order-transfers"
import { runProcessTransfersJob } from "@/lib/transfers/process-transfers"

export type LegacyPayoutRoleIssue = {
  role: "SUPPLIER" | "AFFILIATE"
  phantomLedgerId: string | null
  phantomLedgerCents: number
  payoutAtSet: boolean
  transferSuccess: boolean
  stripeTransferId: string | null
  needsConnectBackfill: boolean
}

export type LegacyPayoutOrderScan = {
  orderId: string
  status: string
  customerEmail: string
  createdAt: Date
  splitStatus: string
  payoutStatus: string
  roles: LegacyPayoutRoleIssue[]
  needsRemediation: boolean
}

export type LegacyPayoutScanSummary = {
  scannedOrders: number
  needsRemediation: number
  phantomLedgerRows: number
  orders: LegacyPayoutOrderScan[]
}

export type LegacyPayoutRemediateResult = {
  orderId: string
  dryRun: boolean
  phantomLedgerMarked: number
  payoutTimestampsCleared: Array<"SUPPLIER" | "AFFILIATE">
  transferAttemptsReset: boolean
  transferJob: Awaited<ReturnType<typeof runProcessTransfersJob>> | null
  skippedReason?: string
}

const MARKETPLACE_STATUSES = ["paid", "preparing", "shipped", "refunded"] as const

function roleFromLegacyKey(key: string): "SUPPLIER" | "AFFILIATE" | null {
  if (key.startsWith("payout:supplier:")) return "SUPPLIER"
  if (key.startsWith("payout:affiliate:")) return "AFFILIATE"
  return null
}

async function loadRoleContext(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      customerEmail: true,
      createdAt: true,
      splitStatus: true,
      payoutStatus: true,
      supplierPayoutAt: true,
      affiliatePayoutAt: true,
      supplierId: true,
      affiliateId: true,
      transferAttempts: {
        select: {
          role: true,
          status: true,
          stripeTransferId: true,
          amountCents: true,
        },
      },
      merchantPayoutLedger: {
        where: { entryType: "PAYOUT" },
        select: {
          id: true,
          beneficiaryRole: true,
          amountCents: true,
          stripeTransferId: true,
          payoutRail: true,
          idempotencyKey: true,
          blindDropshipOrderId: true,
        },
      },
    },
  })
}

function buildRoleIssue(
  role: "SUPPLIER" | "AFFILIATE",
  order: NonNullable<Awaited<ReturnType<typeof loadRoleContext>>>
): LegacyPayoutRoleIssue {
  const attempt = order.transferAttempts.find((a) => a.role === role)
  const transferSuccess =
    attempt?.status === "SUCCESS" && Boolean(attempt.stripeTransferId?.trim())

  const legacyKey = legacyLedgerIdempotencyKey(role, order.id)
  const phantomLedger = order.merchantPayoutLedger.find(
    (e) =>
      e.beneficiaryRole === role &&
      !e.stripeTransferId &&
      e.payoutRail !== "phantom_legacy" &&
      (e.idempotencyKey === legacyKey || e.idempotencyKey.startsWith(`payout:${role.toLowerCase()}:`))
  )

  const tsField = payoutTimestampFieldForRole(role)
  const payoutAtSet = order[tsField] != null

  const stripeLinkedLedger = order.merchantPayoutLedger.find(
    (e) => e.beneficiaryRole === role && isLedgerPayoutRealized(e)
  )

  const needsConnectBackfill =
    !transferSuccess &&
    !stripeLinkedLedger &&
    (phantomLedger != null || payoutAtSet)

  return {
    role,
    phantomLedgerId: phantomLedger?.id ?? null,
    phantomLedgerCents: phantomLedger?.amountCents ?? 0,
    payoutAtSet,
    transferSuccess,
    stripeTransferId: attempt?.stripeTransferId ?? stripeLinkedLedger?.stripeTransferId ?? null,
    needsConnectBackfill,
  }
}

export function analyzeLegacyPayoutOrder(
  order: NonNullable<Awaited<ReturnType<typeof loadRoleContext>>>
): LegacyPayoutOrderScan {
  const roles = [
    buildRoleIssue("SUPPLIER", order),
    buildRoleIssue("AFFILIATE", order),
  ]
  return {
    orderId: order.id,
    status: order.status,
    customerEmail: order.customerEmail,
    createdAt: order.createdAt,
    splitStatus: order.splitStatus,
    payoutStatus: order.payoutStatus,
    roles,
    needsRemediation: roles.some((r) => r.needsConnectBackfill),
  }
}

/** Find marketplace orders with phantom pre-unification payout state. */
export async function scanLegacyPayoutOrders(options?: {
  limit?: number
  orderId?: string
}): Promise<LegacyPayoutScanSummary> {
  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 1000)

  const phantomLedgerRows = await prisma.merchantPayoutLedger.findMany({
    where: {
      entryType: "PAYOUT",
      orderId: { not: null },
      blindDropshipOrderId: null,
      stripeTransferId: null,
      payoutRail: { not: "phantom_legacy" },
      OR: [
        { idempotencyKey: { startsWith: "payout:supplier:" } },
        { idempotencyKey: { startsWith: "payout:affiliate:" } },
      ],
      ...(options?.orderId ? { orderId: options.orderId } : {}),
    },
    select: { orderId: true },
    distinct: ["orderId"],
    take: limit,
  })

  const payoutAtOnly = options?.orderId
    ? []
    : await prisma.order.findMany({
        where: {
          status: { in: [...MARKETPLACE_STATUSES] },
          OR: [{ supplierPayoutAt: { not: null } }, { affiliatePayoutAt: { not: null } }],
          NOT: { payoutStatus: "PAID" },
          transferAttempts: {
            none: { status: "SUCCESS", stripeTransferId: { not: null } },
          },
        },
        select: { id: true },
        take: limit,
      })

  const orderIds = [
    ...new Set([
      ...phantomLedgerRows.map((r) => r.orderId!).filter(Boolean),
      ...payoutAtOnly.map((o) => o.id),
      ...(options?.orderId ? [options.orderId] : []),
    ]),
  ].slice(0, limit)

  const orders: LegacyPayoutOrderScan[] = []
  for (const orderId of orderIds) {
    const row = await loadRoleContext(orderId)
    if (!row) continue
    const analysis = analyzeLegacyPayoutOrder(row)
    if (analysis.needsRemediation || options?.orderId) {
      orders.push(analysis)
    }
  }

  return {
    scannedOrders: orderIds.length,
    needsRemediation: orders.filter((o) => o.needsRemediation).length,
    phantomLedgerRows: phantomLedgerRows.length,
    orders,
  }
}

async function markPhantomLedgerRows(
  tx: Prisma.TransactionClient,
  orderId: string,
  role: "SUPPLIER" | "AFFILIATE"
): Promise<number> {
  const legacyKey = legacyLedgerIdempotencyKey(role, orderId)
  const result = await tx.merchantPayoutLedger.updateMany({
    where: {
      orderId,
      beneficiaryRole: role,
      entryType: "PAYOUT",
      stripeTransferId: null,
      payoutRail: { not: "phantom_legacy" },
      OR: [
        { idempotencyKey: legacyKey },
        { idempotencyKey: { startsWith: `payout:${role.toLowerCase()}:` } },
      ],
    },
    data: {
      payoutRail: "phantom_legacy",
      note: "Pre-unification phantom ledger — superseded by Connect backfill (no Stripe transfer occurred).",
    },
  })
  return result.count
}

async function clearPhantomPayoutTimestamp(
  tx: Prisma.TransactionClient,
  orderId: string,
  role: "SUPPLIER" | "AFFILIATE"
): Promise<boolean> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      supplierPayoutAt: true,
      affiliatePayoutAt: true,
      transferAttempts: {
        where: { role, status: "SUCCESS" },
        select: { stripeTransferId: true },
      },
      merchantPayoutLedger: {
        where: {
          beneficiaryRole: role,
          entryType: "PAYOUT",
          stripeTransferId: { not: null },
        },
        take: 1,
        select: { id: true },
      },
    },
  })
  if (!order) return false

  const hasRealStripe =
    order.transferAttempts.some((a) => a.stripeTransferId?.trim()) ||
    order.merchantPayoutLedger.length > 0
  if (hasRealStripe) return false

  const tsField = payoutTimestampFieldForRole(role)
  if (order[tsField] == null) return false

  await tx.order.update({
    where: { id: orderId },
    data: { [tsField]: null },
  })
  return true
}

/**
 * Remediate one marketplace order: mark phantom ledger, clear fake payoutAt, reset attempts, run Connect.
 * Idempotent — safe to replay; skips roles already settled via Stripe.
 */
export async function remediateLegacyPayoutOrder(
  orderId: string,
  options?: { dryRun?: boolean; runTransfers?: boolean }
): Promise<LegacyPayoutRemediateResult> {
  const dryRun = options?.dryRun ?? false
  const runTransfers = options?.runTransfers ?? !dryRun

  const order = await loadRoleContext(orderId)
  if (!order) {
    return {
      orderId,
      dryRun,
      phantomLedgerMarked: 0,
      payoutTimestampsCleared: [],
      transferAttemptsReset: false,
      transferJob: null,
      skippedReason: "not_found",
    }
  }

  const analysis = analyzeLegacyPayoutOrder(order)
  if (!analysis.needsRemediation) {
    return {
      orderId,
      dryRun,
      phantomLedgerMarked: 0,
      payoutTimestampsCleared: [],
      transferAttemptsReset: false,
      transferJob: null,
      skippedReason: "no_phantom_state",
    }
  }

  if (dryRun) {
    return {
      orderId,
      dryRun: true,
      phantomLedgerMarked: analysis.roles.filter((r) => r.phantomLedgerId).length,
      payoutTimestampsCleared: analysis.roles
        .filter((r) => r.needsConnectBackfill && r.payoutAtSet)
        .map((r) => r.role),
      transferAttemptsReset: true,
      transferJob: null,
    }
  }

  let phantomLedgerMarked = 0
  const payoutTimestampsCleared: Array<"SUPPLIER" | "AFFILIATE"> = []

  await prisma.$transaction(async (tx) => {
    for (const roleIssue of analysis.roles) {
      if (!roleIssue.needsConnectBackfill) continue
      phantomLedgerMarked += await markPhantomLedgerRows(tx, orderId, roleIssue.role)
      const cleared = await clearPhantomPayoutTimestamp(tx, orderId, roleIssue.role)
      if (cleared) payoutTimestampsCleared.push(roleIssue.role)
    }
  })

  await resetOrderTransferAttempts(orderId)

  let transferJob: Awaited<ReturnType<typeof runProcessTransfersJob>> | null = null
  if (runTransfers) {
    transferJob = await runProcessTransfersJob({
      metric: "legacy_payout_backfill",
      orderId,
    })
  }

  console.log("[payout-legacy-backfill]", {
    orderId,
    phantomLedgerMarked,
    payoutTimestampsCleared,
    transferJob,
    result: "remediated",
  })

  return {
    orderId,
    dryRun: false,
    phantomLedgerMarked,
    payoutTimestampsCleared,
    transferAttemptsReset: true,
    transferJob,
  }
}

export async function remediateLegacyPayoutBatch(options?: {
  limit?: number
  dryRun?: boolean
}): Promise<{
  scan: LegacyPayoutScanSummary
  results: LegacyPayoutRemediateResult[]
}> {
  const scan = await scanLegacyPayoutOrders({ limit: options?.limit ?? 50 })
  const targets = scan.orders.filter((o) => o.needsRemediation)
  const results: LegacyPayoutRemediateResult[] = []

  for (const order of targets) {
    results.push(
      await remediateLegacyPayoutOrder(order.orderId, {
        dryRun: options?.dryRun,
        runTransfers: !options?.dryRun,
      })
    )
  }

  return { scan, results }
}

/** One-shot SQL migration helper — mark all pre-unification phantom ledger rows. */
export async function markAllPhantomLegacyLedgerRows(): Promise<number> {
  const result = await prisma.merchantPayoutLedger.updateMany({
    where: {
      entryType: "PAYOUT",
      orderId: { not: null },
      blindDropshipOrderId: null,
      stripeTransferId: null,
      payoutRail: { not: "phantom_legacy" },
      OR: [
        { idempotencyKey: { startsWith: "payout:supplier:" } },
        { idempotencyKey: { startsWith: "payout:affiliate:" } },
      ],
    },
    data: {
      payoutRail: "phantom_legacy",
      note: "Pre-unification phantom ledger — superseded by Connect backfill (no Stripe transfer occurred).",
    },
  })
  console.log("[payout-legacy-backfill]", {
    action: "mark_all_phantom",
    count: result.count,
  })
  return result.count
}

export { roleFromLegacyKey }

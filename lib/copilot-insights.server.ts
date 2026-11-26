import "server-only"

import type { Prisma } from "@prisma/client"

import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import {
  accountOrder,
  accuracyBy,
  summariseAccuracy,
  type AccuracyStats,
  type OrderAccuracyRow,
} from "@/lib/copilot-accuracy"
import { evaluateActionOutcome, trackRecords, type ActionOutcome, type TrackRecord } from "@/lib/copilot-outcomes"
import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"
import { prisma } from "@/lib/prisma"
import { COPILOT_APPLY_ACTION, COPILOT_UNDO_ACTION } from "@/lib/copilot-audit-actions"
import { loadProductRiskContext } from "@/lib/reseller-copilot.server"
import {
  computeSupplierReliability,
  type PlatformBaseline,
  type SupplierOrderObservation,
  type SupplierReliability,
} from "@/lib/supplier-reliability"

const DAY = 86_400_000
export const ACCURACY_WINDOW_DAYS = 180
const MAX_ORDERS = 5_000
const VOID_STATUSES = new Set(["refunded", "cancelled", "canceled", "REFUNDED", "CANCELLED"])

// ─── Order accounting (shared by accuracy and outcomes) ───────────────────────────────────────────────────────────

type AccountingRow = OrderAccuracyRow & { paidAt: Date; affiliateProductId: string }

/**
 * The reseller's amounts for each paid order matching `where`, from the records the payout code itself writes:
 *
 * - settled: the AFFILIATE `TransferAttempt.amountCents` when the split was scheduled — scheduling REWRITES
 *   `Order.affiliatePayoutCents` with that net (lib/transfers/schedule-from-checkout.ts), so the settlement function
 *   must NOT be re-applied to it; otherwise `netAffiliateTransferCents` on the untouched checkout snapshot;
 * - paid: transfers that moved, deduplicated by Stripe transfer id across the ledger (`MerchantPayoutLedger` PAYOUT)
 *   and the Connect attempts (`TransferAttempt` SUCCESS), minus reversals (max of `TransferReversal` and the attempt's
 *   cumulative `reversedAmountCents`, per transfer — the two record the same reversal);
 * - due: settled minus the larger of the recorded clawback and the refunded share of the sale (partial refunds).
 */
async function loadOrderAccounting(where: Prisma.OrderWhereInput, now: Date): Promise<AccountingRow[]> {
  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      affiliateProductId: true,
      productId: true,
      supplierId: true,
      quantity: true,
      basePriceCents: true,
      sellingPriceCents: true,
      commissionCents: true,
      affiliatePayoutCents: true,
      affiliateMarginRetainedCents: true,
      affiliateFeeCents: true,
      affiliateMarginCents: true,
      status: true,
      paidAt: true,
      payoutStatus: true,
      payoutEligibleAt: true,
      product: { select: { categoryId: true } },
      affiliate: { select: { affiliatePlatformFeeBps: true } },
    },
    // Most recent first, so the cap drops the OLDEST orders, never the latest behaviour.
    orderBy: { paidAt: "desc" },
    take: MAX_ORDERS,
  })
  if (orders.length === 0) return []
  const ids = orders.map((o) => o.id)
  const [ledger, attempts, reversals, refunds, risk] = await Promise.all([
    prisma.merchantPayoutLedger.findMany({
      where: { orderId: { in: ids }, beneficiaryRole: "AFFILIATE" },
      select: { orderId: true, entryType: true, amountCents: true, stripeTransferId: true },
    }),
    prisma.transferAttempt.findMany({
      where: { orderId: { in: ids }, role: "AFFILIATE" },
      select: { orderId: true, amountCents: true, reversedAmountCents: true, status: true, stripeTransferId: true },
    }),
    prisma.transferReversal.findMany({
      where: { orderId: { in: ids }, role: "AFFILIATE", status: { in: ["SUCCESS", "PARTIAL"] } },
      select: { orderId: true, amountCents: true, stripeTransferId: true },
    }),
    prisma.orderStripeRefund.groupBy({ by: ["orderId"], where: { orderId: { in: ids } }, _sum: { amountCents: true } }),
    loadProductRiskContext(
      [
        ...new Map(
          orders.map((o) => [
            o.productId,
            { id: o.productId, categoryId: o.product?.categoryId ?? null, supplierId: o.supplierId },
          ]),
        ).values(),
      ],
      now,
    ),
  ])

  type PerOrder = {
    moved: Map<string, number>
    reversedByTransfer: Map<string, number>
    ledgerOnly: number
    clawback: number
    attempt: (typeof attempts)[number] | null
  }
  const per = new Map<string, PerOrder>()
  const get = (id: string) => {
    let v = per.get(id)
    if (!v)
      per.set(id, (v = { moved: new Map(), reversedByTransfer: new Map(), ledgerOnly: 0, clawback: 0, attempt: null }))
    return v
  }
  for (const e of ledger) {
    if (!e.orderId) continue
    const p = get(e.orderId)
    if (e.entryType === "CLAWBACK") p.clawback += e.amountCents
    else if (e.entryType === "PAYOUT" && e.stripeTransferId) p.moved.set(e.stripeTransferId, e.amountCents)
    else if (e.entryType === "PAYOUT") p.ledgerOnly += e.amountCents
  }
  for (const t of attempts) {
    const p = get(t.orderId)
    p.attempt = t
    if (t.status === "SUCCESS" && t.stripeTransferId) {
      p.moved.set(t.stripeTransferId, Math.max(p.moved.get(t.stripeTransferId) ?? 0, t.amountCents))
      if (t.reversedAmountCents > 0) p.reversedByTransfer.set(t.stripeTransferId, t.reversedAmountCents)
    }
  }
  const reversalSums = new Map<string, Map<string, number>>()
  for (const r of reversals) {
    const m = reversalSums.get(r.orderId) ?? new Map<string, number>()
    m.set(r.stripeTransferId, (m.get(r.stripeTransferId) ?? 0) + r.amountCents)
    reversalSums.set(r.orderId, m)
  }
  for (const [orderId, m] of reversalSums) {
    const p = get(orderId)
    for (const [tr, amount] of m) p.reversedByTransfer.set(tr, Math.max(p.reversedByTransfer.get(tr) ?? 0, amount))
  }
  const refundedAmount = new Map(refunds.map((r) => [r.orderId, r._sum.amountCents ?? 0]))

  return orders.flatMap((o) => {
    if (!o.paidAt) return []
    const p = per.get(o.id)
    const qty = Math.max(1, o.quantity)
    const commissionPct = o.basePriceCents > 0 ? (o.commissionCents / o.basePriceCents) * 100 : 0
    const estimatedUnit = buildAffiliateCatalogCardEconomics(Math.round(o.basePriceCents / qty), commissionPct, {
      listedSellingPriceCents: Math.round(o.sellingPriceCents / qty),
      resellerFeeBps: o.affiliate?.affiliatePlatformFeeBps ?? null,
    }).netPartnerGainCents
    const settled = p?.attempt
      ? p.attempt.amountCents
      : netAffiliateTransferCents({
          affiliatePayoutCents: o.affiliatePayoutCents,
          affiliateMarginRetainedCents: o.affiliateMarginRetainedCents,
          affiliateFeeCents: o.affiliateFeeCents,
          affiliateMarginCents: o.affiliateMarginCents,
        })
    const moved = p ? [...p.moved.values()].reduce((a, b) => a + b, 0) : 0
    const reversed = p ? [...p.reversedByTransfer.values()].reduce((a, b) => a + b, 0) : 0
    const refunded = refundedAmount.get(o.id) ?? 0
    const refundedShare = o.sellingPriceCents > 0 ? Math.min(1, refunded / o.sellingPriceCents) : 0
    const row = accountOrder({
      orderId: o.id,
      categoryId: o.product?.categoryId ?? null,
      supplierId: o.supplierId,
      estimatedCents: estimatedUnit * qty,
      settledCents: settled,
      clawbackCents: Math.max(p?.clawback ?? 0, Math.round(settled * refundedShare)),
      voided: VOID_STATUSES.has(o.status) && moved === 0,
      transferredCents: moved,
      reversedCents: reversed,
      recordedNotTransferredCents: p?.ledgerOnly ?? 0,
      payable: o.payoutStatus === "PAID" || (o.payoutEligibleAt != null && o.payoutEligibleAt <= now),
      refunded: refunded > 0 || VOID_STATUSES.has(o.status),
      expectedRefundRate: risk.get(o.productId)?.refundRisk.rate ?? 0.1,
    })
    return [{ ...row, paidAt: o.paidAt, affiliateProductId: o.affiliateProductId }]
  })
}

// ─── Accuracy: estimated vs settled vs due vs paid ───────────────────────────────────────────────────────────────

/**
 * Order-by-order accounting for one reseller (or the whole platform when `affiliateId` is null — owner report).
 * READ-ONLY; never throws (empty result on failure).
 */
export async function loadCopilotAccuracy(args: { affiliateId: string | null; now?: Date }): Promise<{
  rows: OrderAccuracyRow[]
  overall: AccuracyStats
  byCategory: Array<{ key: string; stats: AccuracyStats }>
}> {
  const now = args.now ?? new Date()
  try {
    const rows = await loadOrderAccounting(
      {
        ...(args.affiliateId ? { affiliateId: args.affiliateId } : {}),
        paidAt: { gte: new Date(now.getTime() - ACCURACY_WINDOW_DAYS * DAY), lte: now },
      },
      now,
    )
    return { rows, overall: summariseAccuracy(rows), byCategory: accuracyBy(rows, (r) => r.categoryId) }
  } catch (e) {
    console.warn("[copilot-insights] accuracy unavailable", e instanceof Error ? e.message : e)
    return { rows: [], overall: summariseAccuracy([]), byCategory: [] }
  }
}

// ─── Outcomes of applied actions ─────────────────────────────────────────────────────────────────────────────────

export type AppliedActionOutcome = {
  auditId: string
  type: string
  listingId: string
  appliedAt: string
  outcome: ActionOutcome
}

/**
 * Before/after verdict of every action this reseller applied (undone ones excluded), on what each order is really
 * DUE (partial refunds and clawbacks deducted — same accounting as the accuracy report). Read-only; never throws.
 */
export async function loadActionOutcomes(
  affiliateId: string,
  now: Date = new Date(),
): Promise<{ outcomes: AppliedActionOutcome[]; trackRecords: TrackRecord[] }> {
  try {
    const applied = await prisma.auditLog.findMany({
      where: {
        action: COPILOT_APPLY_ACTION,
        actorId: affiliateId,
        createdAt: { gte: new Date(now.getTime() - ACCURACY_WINDOW_DAYS * DAY) },
      },
      select: { id: true, entityId: true, payload: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    if (applied.length === 0) return { outcomes: [], trackRecords: [] }
    const undone = await prisma.auditLog.findMany({
      where: {
        action: COPILOT_UNDO_ACTION,
        actorId: affiliateId,
        entityId: { in: applied.map((a) => a.entityId!).filter(Boolean) },
      },
      select: { payload: true },
    })
    const undoneIds = new Set(undone.map((u) => (u.payload as { undoOf?: string } | null)?.undoOf).filter(Boolean))
    const live = applied.filter((a) => a.entityId && !undoneIds.has(a.id))
    if (live.length === 0) return { outcomes: [], trackRecords: [] }
    const listingIds = [...new Set(live.map((a) => a.entityId!))]
    const from = new Date(Math.min(...live.map((a) => a.createdAt.getTime())) - 28 * DAY)
    const rows = await loadOrderAccounting(
      { affiliateProductId: { in: listingIds }, paidAt: { gte: from, lte: now } },
      now,
    )
    const byListing = new Map<string, Array<{ paidAt: Date; dueCents: number }>>()
    const categoryOf = new Map<string, string | null>()
    for (const r of rows) {
      categoryOf.set(r.affiliateProductId, r.categoryId)
      byListing.set(r.affiliateProductId, [
        ...(byListing.get(r.affiliateProductId) ?? []),
        { paidAt: r.paidAt, dueCents: r.dueCents },
      ])
    }
    const outcomes = live.map((a) => {
      const type = String((a.payload as { type?: string } | null)?.type ?? "unknown")
      return {
        auditId: a.id,
        type,
        listingId: a.entityId!,
        appliedAt: a.createdAt.toISOString(),
        outcome: evaluateActionOutcome({ type, appliedAt: a.createdAt, orders: byListing.get(a.entityId!) ?? [], now }),
      }
    })
    const records = trackRecords(
      outcomes.flatMap((o) => [
        { key: o.type, verdict: o.outcome.verdict },
        { key: `${o.type}:${categoryOf.get(o.listingId) ?? "unknown"}`, verdict: o.outcome.verdict },
      ]),
    )
    return { outcomes, trackRecords: records }
  } catch (e) {
    console.warn("[copilot-insights] outcomes unavailable", e instanceof Error ? e.message : e)
    return { outcomes: [], trackRecords: [] }
  }
}

// ─── Supplier reliability ────────────────────────────────────────────────────────────────────────────────────────

const LATE_TOLERANCE_DAYS = 2
const PRICE_INCREASE_THRESHOLD = 0.05

type SupplierOrderRow = {
  id: string
  supplierId: string
  productId: string
  variantLabel: string | null
  quantity: number
  basePriceCents: number
  paidAt: Date | null
  deliveredAt: Date | null
  status: string
  product: { handlingDays: number; deliveryMax: number } | null
}

/** Pure mapping of order rows (sorted by paidAt asc) to observations — exported for tests. */
export function toSupplierObservations(
  rows: readonly SupplierOrderRow[],
  refundedOrderIds: ReadonlySet<string> = new Set(),
): Map<string, SupplierOrderObservation[]> {
  const out = new Map<string, SupplierOrderObservation[]>()
  const lastUnit = new Map<string, number>()
  for (const o of rows) {
    if (!o.paidAt) continue
    const promiseDays = (o.product?.handlingDays ?? 1) + (o.product?.deliveryMax ?? 5) + LATE_TOLERANCE_DAYS
    const late = o.deliveredAt ? (o.deliveredAt.getTime() - o.paidAt.getTime()) / DAY > promiseDays : null
    const sku = `${o.productId}|${o.variantLabel ?? ""}`
    const unit = o.basePriceCents / Math.max(1, o.quantity)
    const prev = lastUnit.get(sku)
    lastUnit.set(sku, unit)
    const cancelled = o.status === "cancelled" || o.status === "canceled" || o.status === "CANCELLED"
    const list = out.get(o.supplierId) ?? []
    list.push({
      paidAt: o.paidAt,
      late,
      cancelled,
      refunded: refundedOrderIds.has(o.id) || o.status === "refunded" || o.status === "REFUNDED",
      priceIncrease: prev == null ? null : unit >= prev * (1 + PRICE_INCREASE_THRESHOLD),
    })
    out.set(o.supplierId, list)
  }
  return out
}

function baselineFrom(all: SupplierOrderObservation[]): PlatformBaseline {
  const rate = (f: (o: SupplierOrderObservation) => boolean | null) => {
    const seen = all.filter((o) => f(o) != null)
    return seen.length ? seen.filter((o) => f(o) === true).length / seen.length : 0
  }
  return {
    late: rate((o) => o.late),
    cancelled: rate((o) => o.cancelled),
    refunded: rate((o) => o.refunded),
    priceIncrease: rate((o) => o.priceIncrease),
  }
}

/**
 * Reliability of the given suppliers, against a baseline measured on the platform's recent orders. Read-only, bounded
 * (two queries), never throws (empty map → neutral everywhere).
 */
export async function loadSupplierReliability(
  supplierIds: readonly string[],
  now: Date = new Date(),
): Promise<{ bySupplier: Map<string, SupplierReliability>; baseline: PlatformBaseline | null }> {
  const ids = [...new Set(supplierIds.filter(Boolean))]
  if (ids.length === 0) return { bySupplier: new Map(), baseline: null }
  try {
    const since = new Date(now.getTime() - ACCURACY_WINDOW_DAYS * DAY)
    const select = {
      id: true,
      supplierId: true,
      productId: true,
      variantLabel: true,
      quantity: true,
      basePriceCents: true,
      paidAt: true,
      deliveredAt: true,
      status: true,
      product: { select: { handlingDays: true, deliveryMax: true } },
    } as const
    const [mine, platform] = await Promise.all([
      // Most recent first, so the cap drops the OLDEST orders; re-sorted ascending below for the price sequence.
      prisma.order.findMany({
        where: { supplierId: { in: ids }, paidAt: { gte: since, lte: now } },
        select,
        orderBy: { paidAt: "desc" },
        take: MAX_ORDERS,
      }),
      prisma.order.findMany({
        where: { paidAt: { gte: since, lte: now } },
        select,
        orderBy: { paidAt: "desc" },
        take: MAX_ORDERS,
      }),
    ])
    const refundRows = await prisma.orderStripeRefund.findMany({
      where: { orderId: { in: [...mine, ...platform].map((o) => o.id) } },
      select: { orderId: true },
    })
    const refunded = new Set(refundRows.map((r) => r.orderId))
    const platformSorted = [...platform].sort((a, b) => (a.paidAt?.getTime() ?? 0) - (b.paidAt?.getTime() ?? 0))
    const baseline = baselineFrom([...toSupplierObservations(platformSorted, refunded).values()].flat())
    const mineSorted = [...mine].sort((a, b) => (a.paidAt?.getTime() ?? 0) - (b.paidAt?.getTime() ?? 0))
    const obs = toSupplierObservations(mineSorted, refunded)
    const bySupplier = new Map<string, SupplierReliability>()
    for (const id of ids) bySupplier.set(id, computeSupplierReliability({ orders: obs.get(id) ?? [], baseline, now }))
    return { bySupplier, baseline }
  } catch (e) {
    console.warn("[copilot-insights] supplier reliability unavailable", e instanceof Error ? e.message : e)
    return { bySupplier: new Map(), baseline: null }
  }
}

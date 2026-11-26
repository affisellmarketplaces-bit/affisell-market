import "server-only"

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
  const empty = { rows: [], overall: summariseAccuracy([]), byCategory: [] }
  try {
    const orders = await prisma.order.findMany({
      where: {
        ...(args.affiliateId ? { affiliateId: args.affiliateId } : {}),
        paidAt: { gte: new Date(now.getTime() - ACCURACY_WINDOW_DAYS * DAY), lte: now },
      },
      select: {
        id: true,
        affiliateId: true,
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
        payoutStatus: true,
        payoutEligibleAt: true,
        product: { select: { categoryId: true } },
        affiliate: { select: { affiliatePlatformFeeBps: true } },
      },
      orderBy: { paidAt: "desc" },
      take: MAX_ORDERS,
    })
    if (orders.length === 0) return empty
    const ids = orders.map((o) => o.id)
    const [ledger, reversals, refunds, risk] = await Promise.all([
      prisma.merchantPayoutLedger.findMany({
        where: { orderId: { in: ids }, beneficiaryRole: "AFFILIATE" },
        select: { orderId: true, entryType: true, amountCents: true, stripeTransferId: true },
      }),
      prisma.transferReversal.findMany({
        where: { orderId: { in: ids }, role: "AFFILIATE", status: { in: ["SUCCESS", "PARTIAL"] } },
        select: { orderId: true, amountCents: true },
      }),
      prisma.orderStripeRefund.groupBy({
        by: ["orderId"],
        where: { orderId: { in: ids } },
        _sum: { amountCents: true },
      }),
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
    const sumBy = <T extends { orderId: string | null }>(
      list: T[],
      f: (x: T) => number,
      pred: (x: T) => boolean = () => true,
    ) => {
      const m = new Map<string, number>()
      for (const x of list) if (x.orderId && pred(x)) m.set(x.orderId, (m.get(x.orderId) ?? 0) + f(x))
      return m
    }
    const transferred = sumBy(
      ledger,
      (e) => e.amountCents,
      (e) => e.entryType === "PAYOUT" && Boolean(e.stripeTransferId),
    )
    const ledgerOnly = sumBy(
      ledger,
      (e) => e.amountCents,
      (e) => e.entryType === "PAYOUT" && !e.stripeTransferId,
    )
    const clawbacks = sumBy(
      ledger,
      (e) => e.amountCents,
      (e) => e.entryType === "CLAWBACK",
    )
    const reversed = sumBy(reversals, (r) => r.amountCents)
    const refunded = new Set(refunds.filter((r) => (r._sum.amountCents ?? 0) > 0).map((r) => r.orderId))

    const rows = orders.map((o) => {
      const qty = Math.max(1, o.quantity)
      const unitBase = Math.round(o.basePriceCents / qty)
      const unitSelling = Math.round(o.sellingPriceCents / qty)
      const commissionPct = o.basePriceCents > 0 ? (o.commissionCents / o.basePriceCents) * 100 : 0
      const estimatedUnit = buildAffiliateCatalogCardEconomics(unitBase, commissionPct, {
        listedSellingPriceCents: unitSelling,
        resellerFeeBps: o.affiliate?.affiliatePlatformFeeBps ?? null,
      }).netPartnerGainCents
      const moved = transferred.get(o.id) ?? 0
      return accountOrder({
        orderId: o.id,
        categoryId: o.product?.categoryId ?? null,
        supplierId: o.supplierId,
        estimatedCents: estimatedUnit * qty,
        settledCents: netAffiliateTransferCents({
          affiliatePayoutCents: o.affiliatePayoutCents,
          affiliateMarginRetainedCents: o.affiliateMarginRetainedCents,
          affiliateFeeCents: o.affiliateFeeCents,
          affiliateMarginCents: o.affiliateMarginCents,
        }),
        clawbackCents: clawbacks.get(o.id) ?? 0,
        voided: VOID_STATUSES.has(o.status) && moved === 0,
        transferredCents: moved,
        reversedCents: reversed.get(o.id) ?? 0,
        recordedNotTransferredCents: ledgerOnly.get(o.id) ?? 0,
        payable: o.payoutStatus === "PAID" || (o.payoutEligibleAt != null && o.payoutEligibleAt <= now),
        refunded: refunded.has(o.id) || VOID_STATUSES.has(o.status),
        expectedRefundRate: risk.get(o.productId)?.refundRisk.rate ?? 0.1,
      })
    })
    return { rows, overall: summariseAccuracy(rows), byCategory: accuracyBy(rows, (r) => r.categoryId) }
  } catch (e) {
    console.warn("[copilot-insights] accuracy unavailable", e instanceof Error ? e.message : e)
    return empty
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

/** Before/after verdict of every action this reseller applied (undone ones excluded). Read-only; never throws. */
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
    const listingIds = [...new Set(live.map((a) => a.entityId!))]
    const from = new Date(Math.min(...live.map((a) => a.createdAt.getTime())) - 28 * DAY)
    const orders = await prisma.order.findMany({
      where: { affiliateProductId: { in: listingIds }, paidAt: { gte: from, lte: now } },
      select: {
        affiliateProductId: true,
        paidAt: true,
        status: true,
        affiliatePayoutCents: true,
        affiliateMarginRetainedCents: true,
        affiliateFeeCents: true,
        affiliateMarginCents: true,
        product: { select: { categoryId: true } },
      },
    })
    const byListing = new Map<string, Array<{ paidAt: Date; dueCents: number }>>()
    const categoryOf = new Map<string, string | null>()
    for (const o of orders) {
      if (!o.paidAt) continue
      categoryOf.set(o.affiliateProductId, o.product?.categoryId ?? null)
      const due = VOID_STATUSES.has(o.status)
        ? 0
        : netAffiliateTransferCents({
            affiliatePayoutCents: o.affiliatePayoutCents,
            affiliateMarginRetainedCents: o.affiliateMarginRetainedCents,
            affiliateFeeCents: o.affiliateFeeCents,
            affiliateMarginCents: o.affiliateMarginCents,
          })
      byListing.set(o.affiliateProductId, [
        ...(byListing.get(o.affiliateProductId) ?? []),
        { paidAt: o.paidAt, dueCents: due },
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
      prisma.order.findMany({
        where: { supplierId: { in: ids }, paidAt: { gte: since, lte: now } },
        select,
        orderBy: { paidAt: "asc" },
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
    const obs = toSupplierObservations(mine, refunded)
    const bySupplier = new Map<string, SupplierReliability>()
    for (const id of ids) bySupplier.set(id, computeSupplierReliability({ orders: obs.get(id) ?? [], baseline, now }))
    return { bySupplier, baseline }
  } catch (e) {
    console.warn("[copilot-insights] supplier reliability unavailable", e instanceof Error ? e.message : e)
    return { bySupplier: new Map(), baseline: null }
  }
}

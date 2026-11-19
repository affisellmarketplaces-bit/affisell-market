import "server-only"

import { DAY_MS } from "@/lib/intelligence/order-aggregates"
import { prisma } from "@/lib/prisma"
import type { EconOrder } from "@/lib/strategic-intelligence/product-economics"
import { QUALITY_COHORT_FROM_DAYS, QUALITY_COHORT_TO_DAYS, QUALITY_RETURN_REASONS, type QualityCohortOrder } from "@/lib/strategic-intelligence/quality-risk"

/**
 * ONE read of the paid orders that every order-level analysis of the cockpit judges — product quality, supplier
 * reliability, product economics, and the measurement of decisions on margin. READ-ONLY.
 *
 * Why one read: the three analyses used to read the same window separately, each with its own idea of "disputed"
 * (the ledger by date for one, the ledger by order + the current status for the other). Now:
 *  - same WINDOW: `matureCohortWindow(now)` = orders paid QUALITY_COHORT_FROM_DAYS → QUALITY_COHORT_TO_DAYS ago;
 *  - same ROWS: the same query result is handed to each analysis (`loadOrderFacts` is called once per cockpit
 *    computation — a promise shared inside ONE computation, never a cache across requests: every page view and every
 *    daily run reads the database again, so no financial figure can be stale);
 *  - same DEFINITIONS, decided here once: disputed = a dispute-ledger row for the order (`dispute:<dp>:<orderId>`) OR
 *    the order's current status `disputed`; product-fault returns = QUALITY_RETURN_REASONS, a CANCELLED request not
 *    counted; refunded = Σ OrderStripeRefund (with the tax returned); SLA auto-cancel = `Order.autoCancelledAt`;
 *    transfers = TransferAttempt rows as recorded.
 * A read that hits the cap throws `echantillon_tronque`: no analysis is ever made on a truncated sample.
 */
export const MAX_ORDER_FACTS = 50_000
const CHUNK = 2000

export type MatureOrder = QualityCohortOrder & EconOrder & { autoCancelled: boolean; supplierId: string; paidAt: Date | null }

export function matureCohortWindow(now: Date): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() - QUALITY_COHORT_FROM_DAYS * DAY_MS),
    to: new Date(now.getTime() - QUALITY_COHORT_TO_DAYS * DAY_MS),
  }
}

export async function loadOrderFacts(args: { from: Date; to: Date; productId?: string }): Promise<MatureOrder[]> {
  const rows = await prisma.order.findMany({
    where: { paidAt: { gte: args.from, lt: args.to }, ...(args.productId ? { productId: args.productId } : {}) },
    take: MAX_ORDER_FACTS,
    select: {
      id: true,
      productId: true,
      supplierId: true,
      stripeSessionId: true,
      autoCancelledAt: true,
      paidAt: true,
      status: true,
      totalCents: true,
      subtotalCents: true,
      taxCents: true,
      stripeFeesCents: true,
      basePriceCents: true,
      sellingPriceCents: true,
      affiliatePayoutCents: true,
      affiliateMarginRetainedCents: true,
      affisellFeeCents: true,
      affiliateFeeCents: true,
      supplierFeeCents: true,
      usesAffisellAutoBuy: true,
      aeWholesaleCents: true,
      supplierPriceCents: true,
      affiliateMarginCents: true,
      supplierCommissionRateBps: true,
      affisellCommissionRateBps: true,
      supplierPayoutCents: true,
      commissionCents: true,
      transferAttempts: { select: { role: true, amountCents: true, reversedAmountCents: true, status: true } },
    },
  })
  if (rows.length >= MAX_ORDER_FACTS) throw new Error("echantillon_tronque")
  const ids = rows.map((r) => r.id)
  const reasons = new Map<string, string[]>()
  const refunds = new Map<string, { amount: number; tax: number }>()
  const disputed = new Set<string>()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const [ret, ref, dis] = await Promise.all([
      prisma.orderReturn.findMany({
        where: { orderId: { in: chunk }, reasonCode: { in: [...QUALITY_RETURN_REASONS] }, status: { not: "CANCELLED" } },
        select: { orderId: true, reasonCode: true },
      }),
      prisma.orderStripeRefund.groupBy({ by: ["orderId"], where: { orderId: { in: chunk } }, _sum: { amountCents: true, taxReturnedCents: true } }),
      prisma.processedWebhook.findMany({ where: { orderId: { in: chunk }, id: { startsWith: "dispute:" } }, select: { orderId: true } }),
    ])
    for (const r of ret) reasons.set(r.orderId, [...(reasons.get(r.orderId) ?? []), r.reasonCode])
    for (const r of ref) {
      const s = r._sum as { amountCents?: number | null; taxReturnedCents?: number | null } | null
      refunds.set(r.orderId, { amount: Number(s?.amountCents ?? 0), tax: Number(s?.taxReturnedCents ?? 0) })
    }
    for (const d of dis) if (d.orderId) disputed.add(d.orderId)
  }
  return rows.map((o) => ({
    orderId: o.id,
    productId: o.productId,
    supplierId: o.supplierId,
    stripeSessionId: o.stripeSessionId,
    autoCancelled: o.autoCancelledAt != null,
    paidAt: o.paidAt,
    returnReasons: reasons.get(o.id) ?? [],
    disputed: disputed.has(o.id) || String(o.status ?? "").toLowerCase() === "disputed",
    totalCents: o.totalCents,
    taxCents: o.taxCents,
    stripeFeesCents: o.stripeFeesCents,
    refundedCents: refunds.get(o.id)?.amount ?? 0,
    taxReturnedCents: refunds.get(o.id)?.tax ?? 0,
    split: {
      basePriceCents: o.basePriceCents,
      sellingPriceCents: o.sellingPriceCents,
      subtotalCents: o.subtotalCents,
      affiliatePayoutCents: o.affiliatePayoutCents,
      affiliateMarginRetainedCents: o.affiliateMarginRetainedCents,
      affisellFeeCents: o.affisellFeeCents,
      affiliateFeeCents: o.affiliateFeeCents,
      supplierFeeCents: o.supplierFeeCents,
      usesAffisellAutoBuy: o.usesAffisellAutoBuy,
      aeWholesaleCents: o.aeWholesaleCents,
      supplierPriceCents: o.supplierPriceCents,
      affiliateMarginCents: o.affiliateMarginCents,
      supplierCommissionRateBps: o.supplierCommissionRateBps,
      affisellCommissionRateBps: o.affisellCommissionRateBps,
      supplierPayoutCents: o.supplierPayoutCents,
      commissionCents: o.commissionCents,
    },
    transfers: o.transferAttempts.map((t) => ({ role: t.role, amountCents: t.amountCents, reversedAmountCents: t.reversedAmountCents, status: t.status })),
  }))
}

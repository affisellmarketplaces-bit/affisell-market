import "server-only"

import { DAY_MS } from "@/lib/intelligence/order-aggregates"
import { prisma } from "@/lib/prisma"
import type { EconOrder } from "@/lib/strategic-intelligence/product-economics"
import { QUALITY_COHORT_FROM_DAYS, QUALITY_COHORT_TO_DAYS } from "@/lib/strategic-intelligence/quality-risk"

const MAX_ECON_ORDERS = 50_000
const CHUNK = 2000

/**
 * READ-ONLY. The money facts of every order paid QUALITY_COHORT_FROM_DAYS → QUALITY_COHORT_TO_DAYS ago: the settlement
 * fields of the order row, the transfers really made (TransferAttempt), the refunds (Σ OrderStripeRefund, with the tax
 * returned) and whether the order was ever disputed. A capped read throws `echantillon_tronque` (never judged).
 */
export async function loadEconomicsCohort(now: Date): Promise<{ from: Date; to: Date; orders: EconOrder[] }> {
  const from = new Date(now.getTime() - QUALITY_COHORT_FROM_DAYS * DAY_MS)
  const to = new Date(now.getTime() - QUALITY_COHORT_TO_DAYS * DAY_MS)
  const rows = await prisma.order.findMany({
    where: { paidAt: { gte: from, lt: to } },
    take: MAX_ECON_ORDERS,
    select: {
      id: true,
      productId: true,
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
  if (rows.length >= MAX_ECON_ORDERS) throw new Error("echantillon_tronque")
  const ids = rows.map((r) => r.id)
  const refunds = new Map<string, { amount: number; tax: number }>()
  const disputed = new Set<string>()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const [ref, dis] = await Promise.all([
      prisma.orderStripeRefund.groupBy({ by: ["orderId"], where: { orderId: { in: chunk } }, _sum: { amountCents: true, taxReturnedCents: true } }),
      prisma.processedWebhook.findMany({ where: { orderId: { in: chunk }, id: { startsWith: "dispute:" } }, select: { orderId: true } }),
    ])
    for (const r of ref) {
      const s = r._sum as { amountCents?: number | null; taxReturnedCents?: number | null } | null
      refunds.set(r.orderId, { amount: Number(s?.amountCents ?? 0), tax: Number(s?.taxReturnedCents ?? 0) })
    }
    for (const d of dis) if (d.orderId) disputed.add(d.orderId)
  }
  return {
    from,
    to,
    orders: rows.map((o) => ({
      orderId: o.id,
      productId: o.productId,
      totalCents: o.totalCents,
      taxCents: o.taxCents,
      stripeFeesCents: o.stripeFeesCents,
      refundedCents: refunds.get(o.id)?.amount ?? 0,
      taxReturnedCents: refunds.get(o.id)?.tax ?? 0,
      disputed: disputed.has(o.id) || String(o.status ?? "").toLowerCase() === "disputed",
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
    })),
  }
}

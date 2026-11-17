import "server-only"

import { DAY_MS } from "@/lib/intelligence/order-aggregates"
import { prisma } from "@/lib/prisma"
import { QUALITY_COHORT_FROM_DAYS, QUALITY_COHORT_TO_DAYS, QUALITY_RETURN_REASONS, type QualityCohortOrder } from "@/lib/strategic-intelligence/quality-risk"

/** Bounded: a capped read is never judged (`echantillon_tronque`). */
export const MAX_COHORT_ROWS = 50_000

export type CohortOrder = QualityCohortOrder & { autoCancelled: boolean }

/**
 * Orders paid QUALITY_COHORT_FROM_DAYS → QUALITY_COHORT_TO_DAYS ago, with their product-fault returns, their
 * dispute flag and their SLA auto-cancellation — ONE read shared by the quality detector and the supplier reliability
 * index, so both judge exactly the same orders. READ-ONLY.
 */
export async function loadOrderCohort(now: Date): Promise<{ from: Date; to: Date; orders: CohortOrder[] }> {
  const from = new Date(now.getTime() - QUALITY_COHORT_FROM_DAYS * DAY_MS)
  const to = new Date(now.getTime() - QUALITY_COHORT_TO_DAYS * DAY_MS)
  const [cohort, returns, ledger] = await Promise.all([
    prisma.order.findMany({
      where: { paidAt: { gte: from, lt: to } },
      take: MAX_COHORT_ROWS,
      select: { id: true, productId: true, supplierId: true, stripeSessionId: true, autoCancelledAt: true },
    }),
    prisma.orderReturn.findMany({
      // A request the buyer withdrew is not counted; a rejected one still is (a complaint, not yet verified).
      where: { order: { paidAt: { gte: from, lt: to } }, reasonCode: { in: [...QUALITY_RETURN_REASONS] }, status: { not: "CANCELLED" } },
      take: MAX_COHORT_ROWS,
      select: { orderId: true, reasonCode: true },
    }),
    prisma.processedWebhook.findMany({ where: { id: { startsWith: "dispute:" }, createdAt: { gte: from } }, take: MAX_COHORT_ROWS, select: { id: true } }),
  ])
  if (cohort.length >= MAX_COHORT_ROWS || returns.length >= MAX_COHORT_ROWS || ledger.length >= MAX_COHORT_ROWS) throw new Error("echantillon_tronque")
  const reasonsBy = new Map<string, string[]>()
  for (const r of returns) reasonsBy.set(r.orderId, [...(reasonsBy.get(r.orderId) ?? []), r.reasonCode])
  // Ledger ids are `dispute:<dp_id>:<orderId>` (lib/orders/dispute-hold.server.ts).
  const disputed = new Set(ledger.map((r) => r.id.split(":")[2]).filter(Boolean))
  return {
    from,
    to,
    orders: cohort.map((o) => ({
      orderId: o.id,
      productId: o.productId,
      supplierId: o.supplierId,
      stripeSessionId: o.stripeSessionId,
      returnReasons: reasonsBy.get(o.id) ?? [],
      disputed: disputed.has(o.id),
      autoCancelled: o.autoCancelledAt != null,
    })),
  }
}

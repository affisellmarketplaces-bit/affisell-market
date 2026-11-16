import "server-only"

import type { Prisma } from "@prisma/client"

import type { PaidOrderFact } from "@/lib/intelligence/order-aggregates"
import { prisma } from "@/lib/prisma"

const CHUNK = 2000
/** Hard cap on the orders read for one board (a marketplace this size is far below it; beyond, the result says so). */
export const MAX_ORDER_FACTS = 50_000

/**
 * Reads the paid orders matching `where` since `since`, with their refunded amount (Σ OrderStripeRefund) and whether they
 * were ever disputed (dispute ledger `dispute:<dp>:<orderId>`, or the current status). Read-only. `truncated` = the cap
 * was hit: the figures are then a lower bound and the caller must say so.
 */
export async function loadPaidOrderFacts(args: {
  where: Prisma.OrderWhereInput
  since: Date
}): Promise<{ facts: PaidOrderFact[]; truncated: boolean }> {
  const orders = await prisma.order.findMany({
    where: { ...args.where, paidAt: { gte: args.since } },
    orderBy: { paidAt: "desc" },
    take: MAX_ORDER_FACTS + 1,
    select: {
      id: true,
      productId: true,
      quantity: true,
      totalCents: true,
      sellingPriceCents: true,
      paidAt: true,
      affiliatePayoutCents: true,
      status: true,
    },
  })
  const truncated = orders.length > MAX_ORDER_FACTS
  const kept = truncated ? orders.slice(0, MAX_ORDER_FACTS) : orders
  const ids = kept.map((o) => o.id)

  const refunded = new Map<string, number>()
  const disputed = new Set<string>()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const [refunds, disputes] = await Promise.all([
      prisma.orderStripeRefund.groupBy({ by: ["orderId"], where: { orderId: { in: chunk } }, _sum: { amountCents: true } }),
      prisma.processedWebhook.findMany({
        where: { orderId: { in: chunk }, id: { startsWith: "dispute:" } },
        select: { orderId: true },
      }),
    ])
    for (const r of refunds) refunded.set(r.orderId, Number((r._sum as { amountCents?: number | null } | null)?.amountCents ?? 0))
    for (const d of disputes) if (d.orderId) disputed.add(d.orderId)
  }

  const facts: PaidOrderFact[] = []
  for (const o of kept) {
    if (!o.paidAt) continue
    facts.push({
      orderId: o.id,
      productId: o.productId,
      quantity: o.quantity,
      chargedCents: o.totalCents ?? o.sellingPriceCents,
      paidAt: o.paidAt,
      affiliatePayoutCents: o.affiliatePayoutCents,
      refundedCents: refunded.get(o.id) ?? 0,
      disputed: disputed.has(o.id) || String(o.status ?? "").toLowerCase() === "disputed",
    })
  }
  return { facts, truncated }
}

/** Price in force at `at` per product (base price series): last point at or before it, else the earliest later point's
 * `previousCents`. Null when the history cannot prove it. A missing table = empty map. */
export async function loadBasePriceAt(productIds: string[], at: Date): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (productIds.length === 0) return out
  try {
    const [before, after] = await Promise.all([
      prisma.productPriceHistory.findMany({
        where: { productId: { in: productIds }, variantKey: null, recordedAt: { lte: at } },
        orderBy: { recordedAt: "desc" },
        distinct: ["productId"],
        select: { productId: true, priceCents: true },
      }),
      prisma.productPriceHistory.findMany({
        where: { productId: { in: productIds }, variantKey: null, recordedAt: { gt: at } },
        orderBy: { recordedAt: "asc" },
        distinct: ["productId"],
        select: { productId: true, previousCents: true },
      }),
    ])
    for (const a of after as Array<{ productId: string; previousCents: number | null }>) {
      if (a.previousCents != null && a.previousCents > 0) out.set(a.productId, a.previousCents)
    }
    for (const b of before as Array<{ productId: string; priceCents: number }>) out.set(b.productId, b.priceCents)
  } catch {
    // table not migrated yet: no price evidence
  }
  return out
}

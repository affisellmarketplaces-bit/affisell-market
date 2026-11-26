import "server-only"

import { smoothedRefundRate } from "@/lib/events/journal-mapping"
import { DEFAULT_EXPECTED_REFUND_RATE } from "@/lib/reseller-margin-guard"
import { prisma } from "@/lib/prisma"

/**
 * Measured refund rates per product, from the business journal (S2) — the input the net-margin guard uses instead of
 * its 10 % assumption once there is data. Counts `purchase` and `refund` events per product over a window, then
 * shrinks towards the default so a handful of sales never produce an extreme rate.
 *
 * Never throws: when the journal is unavailable (not migrated, not projected yet) every product keeps the default.
 */
export async function loadProductRefundRates(
  productIds: readonly string[],
  options?: { sinceDays?: number; prior?: number; priorWeight?: number }
): Promise<Map<string, number>> {
  const prior = options?.prior ?? DEFAULT_EXPECTED_REFUND_RATE
  const ids = [...new Set(productIds.filter(Boolean))]
  const rates = new Map<string, number>(ids.map((id) => [id, prior]))
  if (ids.length === 0) return rates
  try {
    const since = new Date(Date.now() - (options?.sinceDays ?? 180) * 86_400_000)
    const grouped = await prisma.affisellTrackEvent.groupBy({
      by: ["productId", "eventType"],
      where: { productId: { in: ids }, eventType: { in: ["purchase", "refund"] }, occurredAt: { gte: since } },
      _count: { _all: true },
    })
    const counts = new Map<string, { purchases: number; refunds: number }>()
    for (const g of grouped) {
      if (!g.productId) continue
      const c = counts.get(g.productId) ?? { purchases: 0, refunds: 0 }
      if (g.eventType === "purchase") c.purchases += g._count._all
      else c.refunds += g._count._all
      counts.set(g.productId, c)
    }
    for (const [productId, c] of counts) {
      rates.set(productId, smoothedRefundRate({ ...c, prior, priorWeight: options?.priorWeight }))
    }
  } catch (e) {
    console.warn("[events-journal] refund rates unavailable — default kept", e instanceof Error ? e.message : e)
  }
  return rates
}

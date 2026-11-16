import "server-only"

import { prisma } from "@/lib/prisma"
import { summarizePriceHistory, type PriceHistorySummary, type PricePoint } from "@/lib/price-history"

/**
 * Reads a product's supplier price history (`ProductPriceHistory`, filled by a database trigger). Defensive: while the
 * migration 20261116200000_product_price_history is not applied the table does not exist — that is "no history yet"
 * (`available: false`), never a crash (same rule as the other isolated tables).
 */
export async function loadProductPriceHistory(
  productId: string,
  opts: { days?: number; now?: Date } = {}
): Promise<
  | { available: true; points: Array<{ priceCents: number; recordedAt: string }>; summary: PriceHistorySummary }
  | { available: false; reason: "not_migrated" | "error" }
> {
  const now = opts.now ?? new Date()
  const days = Math.min(Math.max(Math.round(opts.days ?? 90), 1), 365)
  try {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    // The window's points, plus the last price recorded BEFORE it (the price that was in force at its start).
    const [inside, anchor] = await Promise.all([
      prisma.productPriceHistory.findMany({
        where: { productId, recordedAt: { gt: since } },
        orderBy: { recordedAt: "asc" },
        take: 500,
        select: { priceCents: true, recordedAt: true },
      }),
      prisma.productPriceHistory.findFirst({
        where: { productId, recordedAt: { lte: since } },
        orderBy: { recordedAt: "desc" },
        select: { priceCents: true, recordedAt: true },
      }),
    ])
    const points: PricePoint[] = [...(anchor ? [anchor] : []), ...inside]
    return {
      available: true,
      points: points.map((p) => ({ priceCents: p.priceCents, recordedAt: p.recordedAt.toISOString() })),
      summary: summarizePriceHistory(points, now),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const notMigrated = /ProductPriceHistory|P2021|does not exist/i.test(message)
    console.warn("[price-history]", { result: notMigrated ? "table_missing" : "read_failed", productId })
    return { available: false, reason: notMigrated ? "not_migrated" : "error" }
  }
}

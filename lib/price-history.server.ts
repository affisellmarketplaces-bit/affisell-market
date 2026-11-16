import "server-only"

import { prisma } from "@/lib/prisma"
import { summarizePriceHistory, type PriceHistorySummary, type PricePoint } from "@/lib/price-history"

/**
 * Reads a product's supplier price history (`ProductPriceHistory`, filled by database triggers). Defensive: while the
 * migration 20261116200000_product_price_history is not applied the table does not exist — that is "no history yet"
 * (`available: false`), never a crash (same rule as the other isolated tables).
 *
 * The base price (`variantKey` NULL) and each variant price (`row:<name>` / `pv:<color>/<size>`) are separate series: a
 * variant price is never mixed into the product's base-price trend.
 */
type Row = { variantKey: string | null; priceCents: number; recordedAt: Date }

export type VariantPriceHistory = { variantKey: string; label: string; summary: PriceHistorySummary }

export function variantKeyLabel(key: string): string {
  if (key.startsWith("row:")) return key.slice(4)
  if (key.startsWith("pv:")) {
    const [color, size] = key.slice(3).split("/")
    return [color, size].filter((p) => p && p.trim()).join(" / ") || "Variante"
  }
  return key
}

/** Pure: groups rows by series; each series gets the anchor (last point at or before the window start) + its points. */
export function groupPriceSeries(rows: Row[]): { base: PricePoint[]; variants: Map<string, PricePoint[]> } {
  const base: PricePoint[] = []
  const variants = new Map<string, PricePoint[]>()
  for (const r of rows) {
    const point = { priceCents: r.priceCents, recordedAt: r.recordedAt }
    if (r.variantKey == null) base.push(point)
    else {
      const list = variants.get(r.variantKey) ?? []
      list.push(point)
      variants.set(r.variantKey, list)
    }
  }
  return { base, variants }
}

export async function loadProductPriceHistory(
  productId: string,
  opts: { days?: number; now?: Date } = {}
): Promise<
  | {
      available: true
      points: Array<{ priceCents: number; recordedAt: string }>
      summary: PriceHistorySummary
      variants: VariantPriceHistory[]
    }
  | { available: false; reason: "not_migrated" | "error" }
> {
  const now = opts.now ?? new Date()
  const days = Math.min(Math.max(Math.round(opts.days ?? 90), 1), 365)
  try {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const select = { variantKey: true, priceCents: true, recordedAt: true } as const
    // The window's points, plus — per series — the last price recorded BEFORE it (the price in force at its start).
    const [inside, anchors] = await Promise.all([
      prisma.productPriceHistory.findMany({
        where: { productId, recordedAt: { gt: since } },
        orderBy: { recordedAt: "asc" },
        take: 2000,
        select,
      }),
      prisma.productPriceHistory.findMany({
        where: { productId, recordedAt: { lte: since } },
        orderBy: { recordedAt: "desc" },
        distinct: ["variantKey"],
        select,
      }),
    ])
    const rows = [...(anchors as Row[]), ...(inside as Row[])]
    const { base, variants } = groupPriceSeries(rows)
    return {
      available: true,
      points: base
        .slice()
        .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
        .map((p) => ({ priceCents: p.priceCents, recordedAt: p.recordedAt.toISOString() })),
      summary: summarizePriceHistory(base, now),
      variants: [...variants.entries()]
        .map(([variantKey, pts]) => ({ variantKey, label: variantKeyLabel(variantKey), summary: summarizePriceHistory(pts, now) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const notMigrated = /ProductPriceHistory|P2021|does not exist|variantKey/i.test(message)
    console.warn("[price-history]", { result: notMigrated ? "table_missing" : "read_failed", productId })
    return { available: false, reason: notMigrated ? "not_migrated" : "error" }
  }
}

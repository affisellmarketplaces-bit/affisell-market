import { prisma } from "@/lib/prisma"
import type { StockCheckLine } from "@/lib/checkout-stock"
import { parseListingKind } from "@/lib/supplier-commission"
import type { TableVariant } from "@/lib/variant-selection"

/**
 * Adds the `ProductVariant` table rows to the lines of products that have NO advanced rows, so the check before payment
 * judges their choice and availability with the shared rule (founder brief 2026-11-19 §2). Read-only, one query.
 * Never throws: an unreadable table leaves the lines as they were (the previous, unjudged behaviour) and is logged.
 */
export async function withTableVariants<T extends StockCheckLine>(lines: T[], db: Pick<typeof prisma, "productVariant"> = prisma): Promise<T[]> {
  const ids = [
    ...new Set(
      lines
        // Only products flagged as having variants keep them in the table (a simple product is never queried).
        .filter((l) => parseListingKind(l.listingKind) === "PHYSICAL" && l.hasVariants === true && l.tableVariants === undefined)
        .filter((l) => !Array.isArray((l.variants as { variantRows?: unknown } | null)?.variantRows) || ((l.variants as { variantRows: unknown[] }).variantRows.length === 0))
        .map((l) => l.productId)
    ),
  ]
  if (ids.length === 0) return lines
  try {
    const rows = await db.productVariant.findMany({
      where: { productId: { in: ids } },
      select: { productId: true, color: true, size: true, stock: true, customData: true },
      orderBy: { id: "asc" },
      take: 5_000,
    })
    const by = new Map<string, TableVariant[]>()
    for (const r of rows) by.set(r.productId, [...(by.get(r.productId) ?? []), { color: r.color, size: r.size, stock: r.stock, customData: r.customData }])
    return lines.map((l) => (by.has(l.productId) ? { ...l, tableVariants: by.get(l.productId)! } : l))
  } catch (error) {
    console.error("[checkout] table_variants_unreadable", error instanceof Error ? error.message : "unknown")
    return lines
  }
}

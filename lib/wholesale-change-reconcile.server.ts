import "server-only"

import { buildWholesaleSnapshot } from "@/lib/affiliate-wholesale-change-guard"
import { notifyAffiliatesOfWholesaleChange } from "@/lib/affiliate-wholesale-change-notify"
import { prisma } from "@/lib/prisma"

/**
 * Supplier price increases from EVERY writer reach the resellers (automation D, built on the F1 price history).
 *
 * The reseller margin guard (`notifyAffiliatesOfWholesaleChange`: flags `marginReviewNeeded`, notifies, warns "possible
 * sale at a loss") was only called by the supplier product form and the supplier CSV import. An AliExpress refresh, an
 * integration sync, Dropforge, the admin enlist or a script could raise `Product.basePriceCents` and every reseller kept
 * selling at the old price — possibly below the new supplier price — without knowing.
 *
 * The `ProductPriceHistory` trigger records every change whatever wrote it; this pass reads the rows recorded since its
 * cursor, and for each product whose supplier price went UP over that span runs the SAME guard with "before" = the price
 * before the first change of the span. Duplicates are harmless: the guard notifies a listing once per price state
 * (`marginReviewAlertHash`), so a change the form already reported is flagged again (idempotent) but not re-notified.
 * The cursor (an `AuditLog` row, no migration) moves after the batch is processed — also past a product that failed (it is
 * logged and counted, and the cron answers 500 so the run shows it): one permanently broken product must not freeze every
 * later reconciliation.
 */
const CURSOR_ID = "wholesale-reconcile-cursor"
const BATCH = 500

type HistoryRow = { id: bigint; productId: string; priceCents: number; previousCents: number | null }

export type WholesaleReconcileResult = {
  rowsRead: number
  productsWithIncrease: number
  listingsFlagged: number
  notificationsSent: number
  failed: number
  cursor: string
}

async function readCursor(): Promise<bigint> {
  const row = await prisma.auditLog.findUnique({ where: { id: CURSOR_ID }, select: { payload: true } })
  const raw = (row?.payload as { lastId?: unknown } | null)?.lastId
  try {
    return typeof raw === "string" && /^\d+$/.test(raw) ? BigInt(raw) : BigInt(0)
  } catch {
    return BigInt(0)
  }
}

async function writeCursor(lastId: bigint): Promise<void> {
  await prisma.auditLog.upsert({
    where: { id: CURSOR_ID },
    create: { id: CURSOR_ID, action: "wholesale.reconcile_cursor", entityType: "ProductPriceHistory", payload: { lastId: lastId.toString() } },
    update: { payload: { lastId: lastId.toString() } },
  })
}

/** Pure: per product, the price before the span and the latest price, for the products that went UP. */
export function increasesFromHistory(rows: Array<Pick<HistoryRow, "productId" | "priceCents" | "previousCents">>): Map<
  string,
  { beforeCents: number; afterCents: number }
> {
  const span = new Map<string, { beforeCents: number; afterCents: number }>()
  for (const r of rows) {
    if (r.previousCents == null) continue // a creation is not an increase
    const cur = span.get(r.productId)
    if (!cur) span.set(r.productId, { beforeCents: r.previousCents, afterCents: r.priceCents })
    else cur.afterCents = r.priceCents
  }
  for (const [id, s] of span) if (!(s.afterCents > s.beforeCents)) span.delete(id)
  return span
}

export async function reconcileWholesaleIncreases(): Promise<WholesaleReconcileResult> {
  const cursor = await readCursor()
  let rows: HistoryRow[]
  try {
    rows = await prisma.productPriceHistory.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true, productId: true, priceCents: true, previousCents: true },
    })
  } catch (error) {
    // Migration not applied yet: nothing to reconcile (the history table does not exist).
    console.warn("[wholesale-reconcile]", {
      result: "history_unavailable",
      message: error instanceof Error ? error.message : String(error),
    })
    return { rowsRead: 0, productsWithIncrease: 0, listingsFlagged: 0, notificationsSent: 0, failed: 0, cursor: cursor.toString() }
  }

  const increases = increasesFromHistory(rows)
  let listingsFlagged = 0
  let notificationsSent = 0
  let failed = 0

  for (const [productId, span] of increases) {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          images: true,
          basePriceCents: true,
          variants: true,
          colors: true,
          hasVariants: true,
          productVariants: {
            select: { color: true, size: true, stock: true, supplierPrice: true, wholesalePriceCents: true },
            orderBy: { createdAt: "asc" },
          },
        },
      })
      if (!product) continue
      const after = buildWholesaleSnapshot(product)
      // Only the base price is known from the history: variant-specific prices keep their current value on both sides,
      // so only the base increase (and the variants priced from the base) count.
      const result = await notifyAffiliatesOfWholesaleChange({
        productId: product.id,
        productName: product.name,
        productImages: product.images,
        before: { basePriceCents: span.beforeCents, variantWholesaleCents: { ...after.variantWholesaleCents } },
        after,
      })
      listingsFlagged += result.listingsFlagged
      notificationsSent += result.notificationsSent
    } catch (error) {
      failed++
      console.error("[wholesale-reconcile]", {
        result: "product_failed",
        productId,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const lastId = rows.length > 0 ? rows[rows.length - 1]!.id : cursor
  if (lastId > cursor) await writeCursor(lastId)

  const result = {
    rowsRead: rows.length,
    productsWithIncrease: increases.size,
    listingsFlagged,
    notificationsSent,
    failed,
    cursor: lastId.toString(),
  }
  console.log("[wholesale-reconcile]", result)
  return result
}

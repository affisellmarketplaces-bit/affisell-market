import "server-only"

import { prisma } from "@/lib/prisma"
import {
  aggregateRestockDemand,
  groupRestockDemandByProduct,
  RESTOCK_DEMAND_MIN_BUYERS,
  type RestockDemandProduct,
  type WatchedVariantToday,
} from "@/lib/restock-watch/restock-demand"
import { locateWatchedVariant, parseRestockWatch, RESTOCK_WATCH_ACTION, type RestockWatch } from "@/lib/restock-watch/restock-watch"
import { rowsForChoice } from "@/lib/variant-selection"

const MAX_PRODUCTS = 1_000
const MAX_WATCHES = 10_000
const CHUNK = 500

export type SupplierRestockDemand = { minBuyers: number; products: RestockDemandProduct[]; truncated: boolean }

/**
 * READ-ONLY, scoped to ONE supplier's own products: distinct buyers waiting for each sold-out variant (≥ 3). Reads the
 * buyers' requests only to count them — no buyer id, date or shop leaves this function (see `restock-demand.ts`).
 */
export async function loadSupplierRestockDemand(supplierId: string, now = new Date()): Promise<SupplierRestockDemand> {
  const products = await prisma.product.findMany({
    where: { supplierId },
    select: {
      id: true,
      name: true,
      variants: true,
      customColumns: true,
      productVariants: { select: { color: true, size: true, stock: true, customData: true }, take: 200 },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_PRODUCTS + 1,
  })
  let truncated = products.length > MAX_PRODUCTS
  const own = products.slice(0, MAX_PRODUCTS)
  if (own.length === 0) return { minBuyers: RESTOCK_DEMAND_MIN_BUYERS, products: [], truncated }
  const byId = new Map(own.map((p) => [p.id, p]))

  const listings = await prisma.affiliateProduct.findMany({ where: { productId: { in: [...byId.keys()] } }, select: { id: true, productId: true } })
  const listingProduct = new Map(listings.map((l) => [l.id, l.productId]))

  const watches: RestockWatch[] = []
  const listingIds = [...listingProduct.keys()]
  for (let i = 0; i < listingIds.length && watches.length <= MAX_WATCHES; i += CHUNK) {
    const rows = await prisma.auditLog.findMany({
      where: { action: RESTOCK_WATCH_ACTION, entityId: { in: listingIds.slice(i, i + CHUNK) }, payload: { path: ["state"], equals: "active" } },
      select: { payload: true },
      take: MAX_WATCHES + 1,
    })
    for (const r of rows) {
      const w = parseRestockWatch(r.payload)
      // The product is the one the LISTING points to today (never trusted from the stored request alone).
      const productId = w ? listingProduct.get(w.listingId) : undefined
      if (w && productId && byId.has(productId)) watches.push({ ...w, productId })
    }
  }
  if (watches.length > MAX_WATCHES) truncated = true

  const variantToday = (productId: string, variantKey: string): WatchedVariantToday => {
    const p = byId.get(productId)
    if (!p) return { status: "unknown" }
    const rows = rowsForChoice(p.variants, p.productVariants, p.customColumns)
    const v = locateWatchedVariant(rows, p.customColumns, variantKey)
    if (v.status !== "found") return { status: v.status }
    if (v.stock > 0) return { status: "available" }
    const name = ((rows as { variantRows?: Array<{ name?: unknown }> }).variantRows?.[v.index]?.name ?? "") as string
    return { status: "sold_out", label: String(name).trim() || "—" }
  }
  const variants = aggregateRestockDemand({ watches: watches.slice(0, MAX_WATCHES), now, variantToday })
  return {
    minBuyers: RESTOCK_DEMAND_MIN_BUYERS,
    products: groupRestockDemandByProduct(variants, new Map(own.map((p) => [p.id, p.name]))),
    truncated,
  }
}

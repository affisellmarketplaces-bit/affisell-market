import "server-only"

import { resolveCheckoutStockMode } from "@/lib/checkout-stock"
import { isStockUnconfirmed, STOCK_UNCONFIRMED_KEY } from "@/lib/import-stock"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import { loadDeclaredLeadTimes } from "@/lib/supplier-catalog-health/diagnose.server"
import { confirmationStillValid, parseStockConfirmation, stockConfirmationId } from "@/lib/supplier-catalog-health/stockout-forecast"
import {
  analyzeVariantStock,
  VARIANT_SHARE_WINDOW_DAYS,
  variantStockWorthShowing,
  type VariantProductVerdict,
} from "@/lib/supplier-catalog-health/variant-stockout"
import { availableUnits } from "@/lib/reseller-replacement/listing-state"

const DAY = 86_400_000
const MAX_PRODUCTS = 1_000
const MAX_PRODUCTS_ALL = 5_000

/**
 * SUPPLIER, READ-ONLY: per-variant stock of its OWN products shown in resellers' shops (≤ 1 000). Only what is worth
 * showing is returned (partial stock-outs, variants at risk, sold products whose variants Affisell can not track).
 */
export async function loadSupplierVariantStock(supplierId: string, now = new Date()): Promise<{ items: VariantProductVerdict[]; truncated: boolean }> {
  const { items, truncated } = await loadVariantStock({ supplierId, now })
  return { items: items.map(({ supplierId: _s, ...v }) => v), truncated }
}

export type VariantStockItem = VariantProductVerdict & { supplierId: string }

/**
 * Same computation for the daily bell, over EVERY supplier (`supplierId: null`, ≤ 5 000 listed products). Each item
 * carries its supplier so the caller groups per supplier — nothing of one supplier is ever put in another's bell.
 */
export async function loadVariantStock(args: { supplierId: string | null; now?: Date }): Promise<{ items: VariantStockItem[]; truncated: boolean }> {
  const now = args.now ?? new Date()
  const supplierId = args.supplierId
  const max = supplierId ? MAX_PRODUCTS : MAX_PRODUCTS_ALL
  const listed = await prisma.affiliateProduct.groupBy({
    by: ["productId"],
    where: { isListed: true, ...(supplierId ? { product: { supplierId } } : {}) },
    _count: { _all: true },
  })
  const truncated = listed.length > max
  const listings = new Map(listed.slice(0, max).map((l) => [l.productId, l._count._all]))
  const ids = [...listings.keys()]
  if (ids.length === 0) return { items: [], truncated }
  const deducts = resolveCheckoutStockMode() === "enforce"
  const [products, orders, pending, confirmations, adminConfirmations, leadTimes] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids }, ...(supplierId ? { supplierId } : {}), isDraft: false },
      select: {
        id: true,
        supplierId: true,
        name: true,
        stock: true,
        hasVariants: true,
        variants: true,
        listingKind: true,
        updatedAt: true,
        attributes: { where: { key: STOCK_UNCONFIRMED_KEY }, select: { key: true, value: true } },
      },
    }),
    prisma.order.findMany({
      where: { productId: { in: ids }, ...(supplierId ? { supplierId } : {}), paidAt: { gte: new Date(now.getTime() - VARIANT_SHARE_WINDOW_DAYS * DAY) } },
      select: { productId: true, paidAt: true, quantity: true, variantLabel: true, affiliateId: true },
      take: 100_000,
    }),
    prisma.order.findMany({
      where: { productId: { in: ids }, ...(supplierId ? { supplierId } : {}), paidAt: { not: null }, shippedAt: null, trackingNumber: null },
      select: { productId: true, quantity: true, variantLabel: true, status: true, paymentSettlementStatus: true },
      take: 20_000,
    }),
    prisma.auditLog.findMany({ where: { id: { in: ids.map(stockConfirmationId) } }, select: { entityId: true, payload: true } }),
    prisma.auditLog.findMany({
      where: { action: "product.stock_confirmed", entityId: { in: ids } },
      select: { entityId: true, createdAt: true, payload: true },
      orderBy: { createdAt: "desc" },
      take: 5_000,
    }),
    loadDeclaredLeadTimes(ids, now),
  ])
  const ordersBy = new Map<string, Array<{ variantLabel: string | null; paidAt: Date; quantity: number; affiliateId: string | null }>>()
  for (const o of orders) {
    if (!o.productId || !o.paidAt) continue
    const list = ordersBy.get(o.productId) ?? []
    list.push({ variantLabel: o.variantLabel, paidAt: o.paidAt, quantity: o.quantity ?? 1, affiliateId: o.affiliateId })
    ordersBy.set(o.productId, list)
  }
  const reservedBy = new Map<string, Array<{ variantLabel: string | null; units: number }>>()
  for (const o of pending) {
    if (!o.productId || isOrderClosedForPayout(o)) continue
    const list = reservedBy.get(o.productId) ?? []
    list.push({ variantLabel: o.variantLabel, units: Math.max(1, o.quantity ?? 1) })
    reservedBy.set(o.productId, list)
  }
  const confBy = new Map(confirmations.map((c) => [c.entityId ?? "", parseStockConfirmation(c.payload)]))
  const adminBy = new Map<string, { at: Date; units: number | null }>()
  for (const a of adminConfirmations) {
    if (!a.entityId || adminBy.has(a.entityId)) continue
    const units = (a.payload as { stock?: unknown } | null)?.stock
    adminBy.set(a.entityId, { at: a.createdAt, units: typeof units === "number" ? units : null })
  }
  const items: VariantStockItem[] = []
  for (const p of products) {
    if ((p.listingKind ?? "PHYSICAL").toUpperCase() !== "PHYSICAL") continue
    // Same confirmation rule as the product forecast, on the sheet's total.
    const total = availableUnits(p)
    const cands: Array<{ at: Date; units: number }> = []
    const sup = confBy.get(p.id)
    if (sup) cands.push({ at: new Date(sup.confirmedAt), units: sup.units })
    const adm = adminBy.get(p.id)
    if (adm && adm.units !== null) cands.push({ at: adm.at, units: adm.units })
    const valid = cands
      .filter((c) => confirmationStillValid({ units: c.units, confirmedAt: c.at.toISOString(), by: "supplier" }, total, deducts))
      .sort((a, b) => b.at.getTime() - a.at.getTime())[0]
    const v = analyzeVariantStock({
      productId: p.id,
      productName: p.name,
      liveListings: listings.get(p.id) ?? 0,
      hasVariants: p.hasVariants,
      variants: p.variants,
      reservedByLabel: reservedBy.get(p.id) ?? [],
      reservedAlreadyDeducted: deducts,
      orders: ordersBy.get(p.id) ?? [],
      confirmedAt: valid ? valid.at : null,
      unconfirmedMarker: isStockUnconfirmed(p.attributes),
      sheetUpdatedAt: p.updatedAt,
      leadTimeDays: leadTimes.get(p.id) ?? null,
      now,
    })
    if (variantStockWorthShowing(v) && p.supplierId) items.push({ ...v, supplierId: p.supplierId })
  }
  items.sort((a, b) => Number(b.partialStockout) - Number(a.partialStockout) || b.blockedVariants - a.blockedVariants || b.variantsAtRisk - a.variantsAtRisk)
  return { items, truncated }
}

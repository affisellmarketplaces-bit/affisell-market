import "server-only"

import { resolveCheckoutStockMode } from "@/lib/checkout-stock"
import { isStockUnconfirmed, STOCK_UNCONFIRMED_KEY } from "@/lib/import-stock"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import { availableUnits } from "@/lib/reseller-replacement/listing-state"
import { loadDeclaredLeadTimes } from "@/lib/supplier-catalog-health/diagnose.server"
import {
  confirmationStillValid,
  FORECAST_WINDOW_DAYS,
  forecastStockout,
  parseStockConfirmation,
  STOCK_CONFIRMATION_ACTION,
  stockConfirmationId,
  type StockoutForecast,
} from "@/lib/supplier-catalog-health/stockout-forecast"

const DAY = 86_400_000
const MAX_PRODUCTS = 5_000

export type StockoutForecastItem = {
  productId: string
  productName: string
  supplierId: string
  liveListings: number
  forecast: StockoutForecast
}

/**
 * READ-ONLY. Forecast for every product shown in ≥ 1 live reseller listing (optionally one supplier's) — the products
 * whose stock-out the resellers' buyers would meet. `truncated` = the cap was reached (partial list, said).
 */
export async function loadStockoutForecasts(opts: { supplierId?: string; now?: Date } = {}): Promise<{ items: StockoutForecastItem[]; truncated: boolean }> {
  const now = opts.now ?? new Date()
  const listed = await prisma.affiliateProduct.groupBy({
    by: ["productId"],
    where: { isListed: true, ...(opts.supplierId ? { product: { supplierId: opts.supplierId } } : {}) },
    _count: { _all: true },
  })
  const truncated = listed.length > MAX_PRODUCTS
  const listings = new Map(listed.slice(0, MAX_PRODUCTS).map((l) => [l.productId, l._count._all]))
  const ids = [...listings.keys()]
  if (ids.length === 0) return { items: [], truncated }
  const since = new Date(now.getTime() - FORECAST_WINDOW_DAYS * DAY)
  const deducts = resolveCheckoutStockMode() === "enforce"
  const [products, sold, pending, confirmations, adminConfirmations, leadTimes] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids }, isDraft: false },
      select: {
        id: true,
        name: true,
        supplierId: true,
        stock: true,
        hasVariants: true,
        variants: true,
        listingKind: true,
        updatedAt: true,
        attributes: { where: { key: STOCK_UNCONFIRMED_KEY }, select: { key: true, value: true } },
      },
    }),
    prisma.order.findMany({
      where: { productId: { in: ids }, paidAt: { gte: since } },
      select: { productId: true, paidAt: true, quantity: true },
      take: 200_000,
    }),
    prisma.order.findMany({
      where: { productId: { in: ids }, paidAt: { not: null }, shippedAt: null, trackingNumber: null },
      select: { productId: true, quantity: true, status: true, paymentSettlementStatus: true },
      take: 50_000,
    }),
    prisma.auditLog.findMany({ where: { id: { in: ids.map(stockConfirmationId) } }, select: { entityId: true, payload: true } }),
    prisma.auditLog.findMany({
      where: { action: "product.stock_confirmed", entityId: { in: ids } },
      select: { entityId: true, createdAt: true, payload: true },
      orderBy: { createdAt: "desc" },
      take: 20_000,
    }),
    loadDeclaredLeadTimes(ids, now),
  ])
  const daily = new Map<string, number[]>()
  for (const o of sold) {
    if (!o.productId || !o.paidAt) continue
    const idx = Math.min(FORECAST_WINDOW_DAYS - 1, Math.max(0, FORECAST_WINDOW_DAYS - 1 - Math.floor((now.getTime() - o.paidAt.getTime()) / DAY)))
    const arr = daily.get(o.productId) ?? Array.from({ length: FORECAST_WINDOW_DAYS }, () => 0)
    arr[idx] += Math.max(1, o.quantity ?? 1)
    daily.set(o.productId, arr)
  }
  const reserved = new Map<string, number>()
  for (const o of pending) {
    if (!o.productId || isOrderClosedForPayout(o)) continue
    reserved.set(o.productId, (reserved.get(o.productId) ?? 0) + Math.max(1, o.quantity ?? 1))
  }
  const confBy = new Map(confirmations.map((c) => [c.entityId ?? "", parseStockConfirmation(c.payload)]))
  const adminBy = new Map<string, { at: Date; units: number | null }>()
  for (const a of adminConfirmations) {
    if (!a.entityId || adminBy.has(a.entityId)) continue
    const units = (a.payload as { stock?: unknown } | null)?.stock
    adminBy.set(a.entityId, { at: a.createdAt, units: typeof units === "number" ? units : null })
  }

  const items: StockoutForecastItem[] = []
  for (const p of products) {
    const declared = availableUnits(p)
    if ((p.listingKind ?? "PHYSICAL").toUpperCase() !== "PHYSICAL") continue
    // The most recent confirmation that still matches the current quantity (supplier click or admin confirmation).
    const candidates: Array<{ at: Date; units: number }> = []
    const sup = confBy.get(p.id)
    if (sup) candidates.push({ at: new Date(sup.confirmedAt), units: sup.units })
    const adm = adminBy.get(p.id)
    if (adm && adm.units !== null) candidates.push({ at: adm.at, units: adm.units })
    const valid = candidates
      .filter((c) => confirmationStillValid({ units: c.units, confirmedAt: c.at.toISOString(), by: "supplier" }, declared, deducts))
      .sort((a, b) => b.at.getTime() - a.at.getTime())[0]
    items.push({
      productId: p.id,
      productName: p.name,
      supplierId: p.supplierId,
      liveListings: listings.get(p.id) ?? 0,
      forecast: forecastStockout({
        declaredUnits: declared,
        confirmedAt: valid ? valid.at : null,
        unconfirmedMarker: isStockUnconfirmed(p.attributes),
        sheetUpdatedAt: p.updatedAt,
        reservedUnits: reserved.get(p.id) ?? 0,
        reservedAlreadyDeducted: deducts,
        dailyUnits: daily.get(p.id) ?? Array.from({ length: FORECAST_WINDOW_DAYS }, () => 0),
        leadTimeDays: leadTimes.get(p.id) ?? null,
        now,
      }),
    })
  }
  const rank: Record<string, number> = { sous_le_delai: 0, probable: 1, a_surveiller: 2, non_evaluable: 3, suffisant: 4 }
  items.sort((a, b) => rank[a.forecast.risk]! - rank[b.forecast.risk]! || (a.forecast.calculation.coverDays ?? 1e9) - (b.forecast.calculation.coverDays ?? 1e9))
  return { items, truncated }
}

export type ConfirmStockResult =
  | { ok: true; units: number; confirmedAt: string }
  | { ok: false; error: "not_found" | "quantity_changed" | "quantity_unknown" | "unconfirmed_import" }

/**
 * The supplier says « the quantity on my sheet is right » — RECORDED with its date, the quantity is NEVER changed here
 * (a different figure goes through the normal product form). Refused when the figure the supplier saw is no longer the
 * current one (someone or a sale changed it meanwhile) and on an imported « quantity to confirm » (that one needs a
 * typed quantity, through the form).
 */
export async function confirmSupplierStock(args: { supplierId: string; productId: string; units: number; now?: Date }): Promise<ConfirmStockResult> {
  const now = args.now ?? new Date()
  const p = await prisma.product.findFirst({
    where: { id: args.productId, supplierId: args.supplierId },
    select: {
      id: true,
      stock: true,
      hasVariants: true,
      variants: true,
      listingKind: true,
      attributes: { where: { key: STOCK_UNCONFIRMED_KEY }, select: { key: true, value: true } },
    },
  })
  if (!p) return { ok: false, error: "not_found" }
  if (isStockUnconfirmed(p.attributes)) return { ok: false, error: "unconfirmed_import" }
  const declared = availableUnits(p)
  if (declared === null) return { ok: false, error: "quantity_unknown" }
  if (declared !== args.units) return { ok: false, error: "quantity_changed" }
  const payload = { units: declared, confirmedAt: now.toISOString(), by: "supplier" as const }
  await prisma.auditLog.upsert({
    where: { id: stockConfirmationId(p.id) },
    create: { id: stockConfirmationId(p.id), action: STOCK_CONFIRMATION_ACTION, entityType: "Product", entityId: p.id, actorId: args.supplierId, payload },
    update: { payload, actorId: args.supplierId },
  })
  return { ok: true, units: declared, confirmedAt: payload.confirmedAt }
}

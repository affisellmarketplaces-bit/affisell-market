import "server-only"

import { isStockUnconfirmed, STOCK_UNCONFIRMED_KEY } from "@/lib/import-stock"
import { evaluateListingReadiness } from "@/lib/listing-compliance/evaluate"
import { IDENTITY_KEYS, LISTING_COMPLIANCE_KEYS } from "@/lib/listing-compliance/keys"
import { readListingReadinessMode } from "@/lib/listing-compliance/mode"
import { prisma } from "@/lib/prisma"
import { commercialHolds, parseSuspensionState, suspensionStateId } from "@/lib/products/affisell-suspension"
import { productHasExplicitSupplierCommission } from "@/lib/supplier-explicit-commission"
import { buildHealthReport, type HealthProduct, type HealthReport } from "@/lib/supplier-catalog-health/diagnose"

/** Newest products first; beyond that the report says it is truncated. */
export const HEALTH_MAX_PRODUCTS = 1000
const DAY = 86_400_000

/**
 * Health of ONE supplier's catalogue. READ-ONLY, scoped to `supplierId`: every
 * query filters on it, nothing is written. Other suppliers' products are never read.
 */
export async function loadSupplierCatalogHealth(supplierId: string, now = new Date()): Promise<HealthReport> {
  const rows = await prisma.product.findMany({
    where: { supplierId },
    orderBy: { createdAt: "desc" },
    take: HEALTH_MAX_PRODUCTS + 1,
    select: {
      id: true,
      name: true,
      description: true,
      images: true,
      categoryId: true,
      listingKind: true,
      isDraft: true,
      active: true,
      basePriceCents: true,
      stock: true,
      hasVariants: true,
      variants: true,
      commissionRate: true,
      offerMode: true,
      deliveryMin: true,
      deliveryMax: true,
      createdAt: true,
      attributes: {
        where: { key: { in: [...new Set([...LISTING_COMPLIANCE_KEYS, IDENTITY_KEYS.gtin, STOCK_UNCONFIRMED_KEY])] } },
        select: { key: true, value: true },
      },
    },
  })
  const truncated = rows.length > HEALTH_MAX_PRODUCTS
  const products = rows.slice(0, HEALTH_MAX_PRODUCTS)
  const ids = products.map((p) => p.id)
  if (ids.length === 0) return buildHealthReport([], { now, readinessMode: readListingReadinessMode() })

  const since = new Date(now.getTime() - 30 * DAY)
  const [orders, listings, holds] = await Promise.all([
    prisma.order.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, supplierId, paidAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.affiliateProduct.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, isListed: true },
      _count: { _all: true },
    }),
    loadHolds(ids),
  ])
  const ordersBy = new Map(orders.map((o) => [o.productId as string, o._count._all]))
  const listingsBy = new Map(listings.map((l) => [l.productId, l._count._all]))

  const input: HealthProduct[] = products.map((p) => {
    const readiness = evaluateListingReadiness({ listingKind: p.listingKind, attributes: p.attributes })
    const rowsRaw = (p.variants as { variantRows?: Array<{ stock?: unknown }> } | null)?.variantRows
    const gtin = p.attributes.find((a) => a.key === IDENTITY_KEYS.gtin)?.value?.trim()
    return {
      id: p.id,
      name: p.name,
      isDraft: p.isDraft,
      active: p.active,
      listingKind: p.listingKind,
      basePriceCents: p.basePriceCents,
      stock: p.stock,
      hasVariants: p.hasVariants,
      stockUnconfirmed: isStockUnconfirmed(p.attributes),
      variantRowStocks: Array.isArray(rowsRaw) && rowsRaw.length > 0 ? rowsRaw.map((r) => r?.stock) : null,
      commissionExplicit: productHasExplicitSupplierCommission({
        commissionRate: p.commissionRate,
        variants: p.variants,
        offerMode: p.offerMode,
      }),
      imageCount: p.images.length,
      descriptionLength: (p.description ?? "").trim().length,
      categoryId: p.categoryId,
      hasGtin: Boolean(gtin),
      deliveryMin: p.deliveryMin,
      deliveryMax: p.deliveryMax,
      safetyBlocking: readiness.applicable ? readiness.blocking.map((i) => i.code) : null,
      holds: holds === null ? null : holds.get(p.id) ?? [],
      paidOrders30d: ordersBy.get(p.id) ?? 0,
      resellersListing: listingsBy.get(p.id) ?? 0,
      createdAt: p.createdAt,
    }
  })
  return buildHealthReport(input, { now, readinessMode: readListingReadinessMode() }, { truncated })
}

/** Recalls + Affisell suspensions in two queries. Null = unreadable (each product then says « not verifiable »). */
async function loadHolds(ids: string[]): Promise<Map<string, Array<"product_recalled" | "product_suspended">> | null> {
  try {
    const [recalls, states] = await Promise.all([
      prisma.productRecall.findMany({ where: { productId: { in: ids } }, select: { productId: true, status: true } }),
      prisma.auditLog.findMany({ where: { id: { in: ids.map(suspensionStateId) } }, select: { id: true, payload: true } }),
    ])
    const recallsBy = new Map<string, string[]>()
    for (const r of recalls) recallsBy.set(r.productId, [...(recallsBy.get(r.productId) ?? []), r.status])
    const stateBy = new Map(states.map((s) => [s.id, s.payload]))
    const out = new Map<string, Array<"product_recalled" | "product_suspended">>()
    for (const id of ids) {
      const st = stateBy.get(suspensionStateId(id))
      out.set(
        id,
        commercialHolds({ recallStatuses: recallsBy.get(id) ?? [], suspension: st ? parseSuspensionState(st) : null })
      )
    }
    return out
  } catch (error) {
    console.error("[catalog-health] holds_unreadable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

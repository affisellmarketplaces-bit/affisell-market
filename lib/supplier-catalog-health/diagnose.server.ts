import "server-only"

import { isStockUnconfirmed, STOCK_UNCONFIRMED_KEY } from "@/lib/import-stock"
import { evaluateListingReadiness } from "@/lib/listing-compliance/evaluate"
import { indistinctVariantRows } from "@/lib/variant-selection"
import { IDENTITY_KEYS, LISTING_COMPLIANCE_KEYS } from "@/lib/listing-compliance/keys"
import { readListingReadinessMode } from "@/lib/listing-compliance/mode"
import { resolveCheckoutStockMode } from "@/lib/checkout-stock"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import { declarationInForceAt } from "@/lib/supplier-costs/declaration"
import { loadDeclarationHistories } from "@/lib/supplier-costs/declaration.server"
import { commercialHolds, parseSuspensionState, suspensionStateId } from "@/lib/products/affisell-suspension"
import { productHasExplicitSupplierCommission } from "@/lib/supplier-explicit-commission"
import {
  buildAvailabilityImpact,
  type AvailabilityImpact,
  type ProductSales,
} from "@/lib/supplier-catalog-health/availability-impact"
import { buildHealthReport, type HealthProduct, type HealthReport } from "@/lib/supplier-catalog-health/diagnose"
import { buildCatalogReadiness, type CatalogReadiness, type CatalogReadinessProduct } from "@/lib/commercial-readiness/catalog-readiness"
import { loadPublicationRules, loadQualityEvidenceSafe, loadSupplierFeeBpsByCategory } from "@/lib/commercial-readiness/readiness-context.server"
import { QUALITY_RESERVED_KEYS } from "@/lib/listing-quality/sheet-facts"

/** Newest products first; beyond that the report says it is truncated. */
export const HEALTH_MAX_PRODUCTS = 1000
const DAY = 86_400_000
const READ_KEYS = [...new Set([...LISTING_COMPLIANCE_KEYS, IDENTITY_KEYS.gtin, STOCK_UNCONFIRMED_KEY, ...QUALITY_RESERVED_KEYS])]

/**
 * Health of ONE supplier's catalogue. READ-ONLY, scoped to `supplierId`: every
 * query filters on it, nothing is written. Other suppliers' products are never read.
 */
export async function loadSupplierCatalogHealth(supplierId: string, now = new Date()): Promise<HealthReport> {
  return (await loadSupplierCatalogHealthDetailed(supplierId, now)).report
}

/** The browser gets the two short lists and the counts — never every product's summary. */
export type CatalogReadinessView = Omit<CatalogReadiness, "all">
export type CatalogHealthWithImpact = HealthReport & { availability: AvailabilityImpact; readiness: CatalogReadinessView | null }

/** The health report + what each availability problem costs in the resellers' shops (same reads, read-only). */
export async function loadSupplierCatalogHealthWithImpact(supplierId: string, now = new Date()): Promise<CatalogHealthWithImpact> {
  const { report, sales, readiness } = await loadSupplierCatalogHealthDetailed(supplierId, now)
  return {
    ...report,
    availability: buildAvailabilityImpact(report.issues, sales, now),
    readiness: readiness ? { byStage: readiness.byStage, toFix: readiness.toFix, readyNotSelling: readiness.readyNotSelling } : null,
  }
}

/** Health report + the commercial-readiness verdict of every saved product (same reads; for the next best action). */
export async function loadSupplierCatalogHealthAndReadiness(
  supplierId: string,
  now = new Date(),
): Promise<{ report: HealthReport; readiness: CatalogReadiness | null }> {
  const { report, readiness } = await loadSupplierCatalogHealthDetailed(supplierId, now)
  return { report, readiness }
}

async function loadSupplierCatalogHealthDetailed(
  supplierId: string,
  now: Date,
): Promise<{ report: HealthReport; sales: Map<string, ProductSales>; readiness: CatalogReadiness | null }> {
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
      customColumns: true,
      commissionRate: true,
      offerMode: true,
      deliveryMin: true,
      deliveryMax: true,
      warehouseType: true,
      deliveryCountryCodes: true,
      createdAt: true,
      updatedAt: true,
      attributes: {
        // Reserved keys only: product safety, identity, stock marker, return window (the 12 sheet elements' inputs).
        where: { key: { in: READ_KEYS } },
        select: { key: true, value: true },
      },
    },
  })
  const truncated = rows.length > HEALTH_MAX_PRODUCTS
  const products = rows.slice(0, HEALTH_MAX_PRODUCTS)
  const ids = products.map((p) => p.id)
  if (ids.length === 0) return { report: buildHealthReport([], { now, readinessMode: readListingReadinessMode() }), sales: new Map(), readiness: null }

  const since = new Date(now.getTime() - 30 * DAY)
  const [orders, lastPaid, listings, holds, pendingRows, leadTimes] = await Promise.all([
    prisma.order.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, supplierId, paidAt: { gte: since } },
      _count: { _all: true },
      _sum: { quantity: true, supplierPayoutCents: true },
    }),
    prisma.order.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, supplierId, paidAt: { not: null } },
      _max: { paidAt: true },
    }),
    prisma.affiliateProduct.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, isListed: true },
      _count: { _all: true },
    }),
    loadHolds(ids),
    // RESERVED: paid, not shipped, not closed (filtered below with the shared rule).
    prisma.order.findMany({
      where: { productId: { in: ids }, supplierId, paidAt: { not: null }, shippedAt: null, trackingNumber: null },
      select: { productId: true, quantity: true, status: true, paymentSettlementStatus: true },
      take: 5000,
    }),
    loadDeclaredLeadTimes(ids, now),
  ])
  const pendingBy = new Map<string, number>()
  for (const o of pendingRows) {
    if (!o.productId || isOrderClosedForPayout(o)) continue
    pendingBy.set(o.productId, (pendingBy.get(o.productId) ?? 0) + Math.max(1, o.quantity ?? 1))
  }
  const pendingDeducted = resolveCheckoutStockMode() === "enforce"
  const ordersBy = new Map(orders.map((o) => [o.productId as string, o._count._all]))
  const unitsBy = new Map(orders.map((o) => [o.productId as string, o._sum.quantity ?? 0]))
  const lastPaidBy = new Map(lastPaid.map((o) => [o.productId as string, o._max.paidAt ?? null]))
  const ordersRowBy = new Map(orders.map((o) => [o.productId as string, o]))
  const sales = new Map<string, ProductSales>()
  for (const id of ids) {
    const o = ordersRowBy.get(id)
    sales.set(id, {
      paidOrders30d: o?._count._all ?? 0,
      units30d: o?._sum.quantity ?? 0,
      supplierAmount30dCents: o?._sum.supplierPayoutCents ?? 0,
      lastPaidAt: lastPaidBy.get(id) ?? null,
    })
  }
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
      indistinctVariants: indistinctVariantRows(p.variants, p.customColumns),
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
      units30d: unitsBy.get(p.id) ?? 0,
      pendingUnits: pendingBy.get(p.id) ?? 0,
      pendingDeducted,
      leadTimeDays: leadTimes.get(p.id) ?? null,
      sheetUpdatedAt: p.updatedAt,
      resellersListing: listingsBy.get(p.id) ?? 0,
      createdAt: p.createdAt,
    }
  })
  for (const hp of input) {
    const s = sales.get(hp.id)
    if (!s) continue
    const rows = Array.isArray(hp.variantRowStocks) ? hp.variantRowStocks.map((v) => Number(v)) : null
    const declared =
      rows && rows.length > 0 ? (rows.every((n) => Number.isFinite(n)) ? rows.reduce((a, b) => a + Math.max(0, Math.round(b)), 0) : null) : hp.hasVariants ? null : hp.stock
    s.position = {
      declaredUnits: declared,
      confirmed: !hp.stockUnconfirmed,
      pendingUnits: hp.pendingUnits ?? 0,
      pendingDeductedByPlatform: pendingDeducted,
      units30d: hp.units30d ?? 0,
      leadTimeDays: hp.leadTimeDays ?? null,
      sheetUpdatedAt: hp.sheetUpdatedAt ?? null,
    }
  }
  const report = buildHealthReport(input, { now, readinessMode: readListingReadinessMode() }, { truncated })
  const readiness = await loadCatalogReadiness(supplierId, products, holds, input, report, now)
  return { report, sales, readiness }
}

/**
 * The commercial-readiness verdict of each saved product — the forms' engine on the stored row (spec counts, fee per
 * category, publication rules and quality evidence read with the same functions as the forms' sources). Read-only;
 * any failure = no readiness block (the health report is still served), never a fake verdict.
 */
async function loadCatalogReadiness(
  supplierId: string,
  products: Array<{
    id: string
    name: string
    description: string | null
    images: string[]
    categoryId: string | null
    listingKind: string | null
    isDraft: boolean
    active: boolean
    basePriceCents: number
    stock: number
    hasVariants: boolean
    variants: unknown
    customColumns: unknown
    commissionRate: number
    offerMode: string | null
    deliveryMin: number | null
    deliveryMax: number | null
    warehouseType: string | null
    deliveryCountryCodes: string[]
    createdAt: Date
    attributes: Array<{ key: string; value: string }>
  }>,
  holds: Map<string, Array<"product_recalled" | "product_suspended">> | null,
  input: HealthProduct[],
  report: HealthReport,
  now: Date,
): Promise<CatalogReadiness | null> {
  try {
    const ids = products.map((p) => p.id)
    const [specCounts, rules, fees, evidence] = await Promise.all([
      prisma.productAttribute.groupBy({
        by: ["productId"],
        where: { productId: { in: ids }, key: { notIn: [...QUALITY_RESERVED_KEYS] }, NOT: { value: "" } },
        _count: { _all: true },
      }),
      loadPublicationRules(supplierId),
      loadSupplierFeeBpsByCategory(supplierId, products.map((p) => p.categoryId)),
      loadQualityEvidenceSafe(),
    ])
    const specBy = new Map(specCounts.map((s) => [s.productId, s._count._all]))
    const codesBy = new Map<string, Set<string>>()
    for (const i of report.issues) codesBy.set(i.productId, (codesBy.get(i.productId) ?? new Set()).add(i.code))
    const healthBy = new Map(input.map((h) => [h.id, h]))
    const items: CatalogReadinessProduct[] = products.map((p) => ({
      productId: p.id,
      productName: p.name,
      active: p.active,
      holds: holds === null ? null : holds.get(p.id) ?? [],
      paidOrders30d: healthBy.get(p.id)?.paidOrders30d ?? 0,
      resellersListing: healthBy.get(p.id)?.resellersListing ?? 0,
      ageDays: Math.floor((now.getTime() - p.createdAt.getTime()) / DAY),
      healthCodes: codesBy.get(p.id) ?? new Set(),
      row: {
        name: p.name,
        description: p.description,
        images: p.images,
        categoryId: p.categoryId,
        listingKind: p.listingKind,
        basePriceCents: p.basePriceCents,
        offerMode: p.offerMode,
        commissionRate: p.commissionRate,
        variants: p.variants,
        customColumns: p.customColumns,
        stock: p.stock,
        hasVariants: p.hasVariants,
        warehouseType: p.warehouseType,
        deliveryCountryCodes: p.deliveryCountryCodes,
        deliveryMin: p.deliveryMin,
        deliveryMax: p.deliveryMax,
        isDraft: p.isDraft,
        attributes: p.attributes,
        specCount: specBy.get(p.id) ?? 0,
      },
    }))
    return buildCatalogReadiness(items, {
      listingReadinessMode: rules.listingReadinessMode,
      merchantVerified: rules.merchantVerified,
      catalogCapReached: rules.catalogCapReached,
      feeBpsByCategory: fees,
      evidence,
    })
  } catch (error) {
    console.error("[catalog-health] readiness_unavailable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

/**
 * Lead time the supplier DECLARED for each product (product-wide declaration in force today, supply-cost register).
 * The supplier's own confidential data, read back for the supplier only. Missing / unreadable = not declared.
 */
export async function loadDeclaredLeadTimes(ids: string[], now: Date): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  try {
    const histories = await loadDeclarationHistories(ids)
    for (const [productId, list] of histories) {
      const inForce = declarationInForceAt(
        list.filter((d) => !d.variantKey),
        now,
      )
      const lead = inForce?.leadTimeDays
      if (typeof lead === "number" && Number.isFinite(lead) && lead >= 0) out.set(productId, lead)
    }
  } catch (error) {
    console.error("[catalog-health] lead_times_unreadable", error instanceof Error ? error.message : "unknown")
  }
  return out
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

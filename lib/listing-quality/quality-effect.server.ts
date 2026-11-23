import "server-only"

import { unstable_cache } from "next/cache"

import {
  buildQualityEffectReport,
  listingDaysInWindow,
  QUALITY_WINDOW_DAYS,
  supplierQualityRecommendations,
  type QualityEffectReport,
  type QualityExposure,
  type QualityProduct,
  type QualityRecommendation,
} from "@/lib/listing-quality/quality-effect"
import { QUALITY_RESERVED_KEYS, sheetSignals } from "@/lib/listing-quality/sheet-facts"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import { rootOfCategory } from "@/lib/strategic-intelligence/catalog-opportunities"

const DAY = 86_400_000
const MAX_PRODUCTS = 5_000
const MAX_ROWS = 60_000
const READ_KEYS = [...QUALITY_RESERVED_KEYS]

async function readProducts(where: { supplierId?: string }) {
  const rows = await prisma.product.findMany({
    where: { active: true, isDraft: false, ...where },
    orderBy: { createdAt: "desc" },
    take: MAX_PRODUCTS + 1,
    select: {
      id: true,
      supplierId: true,
      name: true,
      description: true,
      images: true,
      categoryId: true,
      listingKind: true,
      basePriceCents: true,
      stock: true,
      variants: true,
      customColumns: true,
      deliveryMin: true,
      deliveryMax: true,
      createdAt: true,
      attributes: { where: { key: { in: READ_KEYS } }, select: { key: true, value: true } },
    },
  })
  const truncated = rows.length > MAX_PRODUCTS
  const products = rows.slice(0, MAX_PRODUCTS)
  const ids = products.map((p) => p.id)
  const [specCounts, cats] = await Promise.all([
    ids.length
      ? prisma.productAttribute.groupBy({ by: ["productId"], where: { productId: { in: ids }, key: { notIn: READ_KEYS }, NOT: { value: "" } }, _count: { _all: true } })
      : Promise.resolve([]),
    prisma.category.findMany({ select: { id: true, parentId: true }, take: 50_000 }),
  ])
  const specBy = new Map(specCounts.map((s) => [s.productId, s._count._all]))
  const parentOf = new Map(cats.map((c) => [c.id, c.parentId]))
  const quality: Array<QualityProduct & { name: string }> = products.map((p) => {
    return {
      id: p.id,
      supplierId: p.supplierId,
      name: p.name,
      rootCategoryId: rootOfCategory(p.categoryId, parentOf),
      basePriceCents: p.basePriceCents,
      createdAt: p.createdAt,
      // ONE definition shared with the supplier's forms (lib/listing-quality/sheet-facts.ts).
      ...sheetSignals({
        name: p.name,
        descriptionHtml: p.description ?? "",
        imageCount: p.images.length,
        listingKind: p.listingKind,
        stock: p.stock,
        variants: p.variants,
        customColumns: p.customColumns,
        deliveryMin: p.deliveryMin,
        deliveryMax: p.deliveryMax,
        attributes: p.attributes,
        specCount: specBy.get(p.id) ?? 0,
      }),
    }
  })
  return { quality, truncated }
}

async function readExposure(ids: string[], now: Date) {
  const since = new Date(now.getTime() - QUALITY_WINDOW_DAYS * DAY)
  if (ids.length === 0) return { exposure: new Map<string, QualityExposure & { resellersListing: number }>(), truncated: false }
  const [listings, orders] = await Promise.all([
    prisma.affiliateProduct.findMany({
      where: { productId: { in: ids }, isListed: true },
      select: { productId: true, affiliateId: true, createdAt: true },
      take: MAX_ROWS + 1,
    }),
    prisma.order.findMany({
      where: { productId: { in: ids }, paidAt: { gte: since } },
      select: { productId: true, quantity: true, status: true, paymentSettlementStatus: true },
      take: MAX_ROWS + 1,
    }),
  ])
  const truncated = listings.length > MAX_ROWS || orders.length > MAX_ROWS
  const exposure = new Map<string, QualityExposure & { resellersListing: number }>()
  const get = (id: string) => {
    let e = exposure.get(id)
    if (!e) exposure.set(id, (e = { listingDays: 0, paidOrders: 0, units: 0, closedOrders: 0, resellersListing: 0 }))
    return e
  }
  const resellers = new Map<string, Set<string>>()
  for (const l of listings) {
    get(l.productId).listingDays += listingDaysInWindow(l.createdAt, now)
    resellers.set(l.productId, (resellers.get(l.productId) ?? new Set()).add(l.affiliateId))
  }
  for (const o of orders) {
    if (!o.productId) continue
    const e = get(o.productId)
    e.paidOrders++
    e.units += Math.max(1, o.quantity ?? 1)
    if (isOrderClosedForPayout(o)) e.closedOrders++
  }
  for (const [id, set] of resellers) get(id).resellersListing = set.size
  return { exposure, truncated }
}

async function computeReport(nowIso: string): Promise<QualityEffectReport> {
  const now = new Date(nowIso)
  const { quality, truncated } = await readProducts({})
  const ex = await readExposure(quality.map((p) => p.id), now)
  return buildQualityEffectReport({ products: quality, exposure: ex.exposure, now, truncated: truncated || ex.truncated })
}

/** Marketplace-wide AGGREGATE (no product, supplier or reseller identifier). Cached 6 h: the window is 90 days. */
export async function loadQualityEffectReport(now = new Date()): Promise<QualityEffectReport> {
  const day = now.toISOString().slice(0, 13) // hour bucket → stable key within the cache life
  return unstable_cache(() => computeReport(now.toISOString()), ["listing-quality-effect-v1", day], { revalidate: 6 * 3600 })()
}

/** The supplier's OWN sheets × the aggregate evidence. Nothing about another supplier is read into the answer. */
export async function loadSupplierQualityRecommendations(supplierId: string, now = new Date()): Promise<{
  report: QualityEffectReport
  recommendations: QualityRecommendation[]
}> {
  const report = await loadQualityEffectReport(now)
  const { quality } = await readProducts({ supplierId })
  const { exposure } = await readExposure(quality.map((p) => p.id), now)
  return { report, recommendations: supplierQualityRecommendations({ ownProducts: quality, ownExposure: exposure, report, max: 10 }) }
}

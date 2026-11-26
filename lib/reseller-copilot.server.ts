import "server-only"

import { Prisma } from "@prisma/client"

import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import { affiliateCommissionDisplayPct } from "@/lib/affiliate-product-commission-display"
import { isJournalEnabled, smoothedRefundRate } from "@/lib/events/journal-mapping"
import { prisma } from "@/lib/prisma"
import { DEFAULT_EXPECTED_REFUND_RATE } from "@/lib/reseller-margin-guard"
import { evaluateListingHealth, sortListingHealth, type ListingHealth } from "@/lib/reseller-opportunity-score"
import {
  detectRefundTrend,
  estimateRefundRisk,
  type RefundCounts,
  type RefundRiskEstimate,
  type RefundTrend,
} from "@/lib/reseller-refund-risk"

/** Refund history used for rates (long: refunds arrive weeks after the sale). */
export const RISK_WINDOW_DAYS = 180
/** "Recent" window — demand and refund trend. */
export const RECENT_WINDOW_DAYS = 30

export type ProductRiskContext = {
  refundRisk: RefundRiskEstimate
  /** Paid sales in the last {@link RECENT_WINDOW_DAYS} days (journal). 0 when the journal is off. */
  recentPurchases: number
  /** Supplier's smoothed refund rate; null when the journal is off or the supplier has no sales. */
  supplierRefundRate: number | null
  refundTrend: RefundTrend | null
}

type CountRow = {
  key: string | null
  eventType: string
  recent: boolean
  n: bigint | number
}

function addCount(
  map: Map<string, { all: RefundCounts; recent: RefundCounts; baseline: RefundCounts }>,
  row: CountRow,
) {
  if (!row.key) return
  const n = Number(row.n) || 0
  const c = map.get(row.key) ?? {
    all: { purchases: 0, refunds: 0 },
    recent: { purchases: 0, refunds: 0 },
    baseline: { purchases: 0, refunds: 0 },
  }
  const field = row.eventType === "purchase" ? "purchases" : "refunds"
  c.all[field] += n
  c[row.recent ? "recent" : "baseline"][field] += n
  map.set(row.key, c)
}

function defaultContext(): ProductRiskContext {
  return {
    refundRisk: estimateRefundRisk({}),
    recentPurchases: 0,
    supplierRefundRate: null,
    refundTrend: null,
  }
}

/**
 * Per-product risk context for the copilot, from the business journal (S2): hierarchical refund risk
 * (product → category → default), recent demand, supplier refund rate, refund trend.
 *
 * READ-ONLY, bounded (three grouped queries whatever the catalogue size), and it NEVER throws.
 * Journal off (EVENTS_JOURNAL unset) = every product gets the default context — the same full rollback
 * as `loadProductRefundRates`: events written before are not read.
 */
export async function loadProductRiskContext(
  products: ReadonlyArray<{
    id: string
    categoryId?: string | null
    supplierId?: string | null
  }>,
  now: Date = new Date(),
): Promise<Map<string, ProductRiskContext>> {
  const out = new Map<string, ProductRiskContext>(products.map((p) => [p.id, defaultContext()]))
  if (products.length === 0 || !isJournalEnabled()) return out
  const ids = [...new Set(products.map((p) => p.id))]
  const categoryIds = [...new Set(products.map((p) => p.categoryId).filter((c): c is string => Boolean(c)))]
  const supplierIds = [...new Set(products.map((p) => p.supplierId).filter((s): s is string => Boolean(s)))]
  const since = new Date(now.getTime() - RISK_WINDOW_DAYS * 86_400_000)
  const recentSince = new Date(now.getTime() - RECENT_WINDOW_DAYS * 86_400_000)
  try {
    const kinds = Prisma.sql`e."eventType" IN ('purchase', 'refund') AND e."occurredAt" >= ${since} AND e."occurredAt" <= ${now}`
    const cohortAt = Prisma.sql`COALESCE(pu."occurredAt", e."occurredAt")`
    const cohortRecent = Prisma.sql`(${cohortAt} >= ${recentSince})`
    const [byProduct, byCategory, bySupplier] = await Promise.all([
      // Per product, every event is dated by its PURCHASE (cohort): a refund today of an order paid 3 months ago
      // belongs to that old cohort, not to the recent window — otherwise it would inflate the recent rate (false alarm).
      prisma.$queryRaw<CountRow[]>`
        SELECT e."productId" AS key, e."eventType", ${cohortRecent} AS recent, COUNT(*) AS n
        FROM "AffisellTrackEvent" e
        LEFT JOIN "AffisellTrackEvent" pu
          ON e."eventType" = 'refund' AND pu."eventType" = 'purchase' AND pu."orderId" = e."orderId"
        WHERE e."eventType" IN ('purchase', 'refund') AND e."occurredAt" <= ${now}
          AND ${cohortAt} >= ${since} AND e."productId" IN (${Prisma.join(ids)})
        GROUP BY 1, 2, 3`,
      categoryIds.length === 0
        ? Promise.resolve([] as CountRow[])
        : prisma.$queryRaw<CountRow[]>`
        SELECT p."categoryId" AS key, e."eventType", false AS recent, COUNT(*) AS n
        FROM "AffisellTrackEvent" e JOIN "Product" p ON p."id" = e."productId"
        WHERE ${kinds} AND p."categoryId" IN (${Prisma.join(categoryIds)})
        GROUP BY 1, 2, 3`,
      supplierIds.length === 0
        ? Promise.resolve([] as CountRow[])
        : prisma.$queryRaw<CountRow[]>`
        SELECT e."supplierId" AS key, e."eventType", false AS recent, COUNT(*) AS n
        FROM "AffisellTrackEvent" e
        WHERE ${kinds} AND e."supplierId" IN (${Prisma.join(supplierIds)})
        GROUP BY 1, 2, 3`,
    ])
    const prod = new Map<string, { all: RefundCounts; recent: RefundCounts; baseline: RefundCounts }>()
    const cat = new Map<string, { all: RefundCounts; recent: RefundCounts; baseline: RefundCounts }>()
    const sup = new Map<string, { all: RefundCounts; recent: RefundCounts; baseline: RefundCounts }>()
    byProduct.forEach((r) => addCount(prod, r))
    byCategory.forEach((r) => addCount(cat, r))
    bySupplier.forEach((r) => addCount(sup, r))

    for (const p of products) {
      const pc = prod.get(p.id)
      const cc = p.categoryId ? cat.get(p.categoryId) : undefined
      const sc = p.supplierId ? sup.get(p.supplierId) : undefined
      out.set(p.id, {
        refundRisk: estimateRefundRisk({ product: pc?.all, category: cc?.all }),
        recentPurchases: pc?.recent.purchases ?? 0,
        supplierRefundRate: sc
          ? smoothedRefundRate({
              ...sc.all,
              prior: DEFAULT_EXPECTED_REFUND_RATE,
            })
          : null,
        refundTrend: pc ? detectRefundTrend(pc.recent, pc.baseline) : null,
      })
    }
  } catch (e) {
    console.warn("[reseller-copilot] risk context unavailable — defaults kept", e instanceof Error ? e.message : e)
  }
  return out
}

export const LISTING_HEALTH_MAX_LISTINGS = 200

export type ListingHealthRow = ListingHealth & {
  name: string
  sellingPriceCents: number
  supplierPriceCents: number
  commissionRatePct: number
  netGainCents: number
}

/**
 * Health of every product the reseller already sells, AT THEIR OWN PRICE and with today's supplier price and
 * commission: listings that no longer leave a real net first. Read-only; [] on any failure.
 */
export async function loadResellerListingHealth(
  affiliateId: string,
  options?: { resellerFeeBps?: number | null; limit?: number },
): Promise<ListingHealthRow[]> {
  try {
    const listings = await prisma.affiliateProduct.findMany({
      where: { affiliateId, isListed: true },
      orderBy: { position: "asc" },
      take: Math.min(LISTING_HEALTH_MAX_LISTINGS, Math.max(1, options?.limit ?? LISTING_HEALTH_MAX_LISTINGS)),
      select: {
        id: true,
        sellingPriceCents: true,
        product: {
          select: {
            id: true,
            name: true,
            basePriceCents: true,
            commissionRate: true,
            categoryId: true,
            supplierId: true,
            variants: true,
          },
        },
      },
    })
    if (listings.length === 0) return []
    const risk = await loadProductRiskContext(listings.map((l) => l.product))
    const rows = listings.map((l) => {
      const commissionRatePct = affiliateCommissionDisplayPct({
        commissionRate: Number(l.product.commissionRate) || 0,
        variants: l.product.variants,
        basePriceCents: l.product.basePriceCents,
      })
      const economics = buildAffiliateCatalogCardEconomics(l.product.basePriceCents, commissionRatePct, {
        listedSellingPriceCents: l.sellingPriceCents,
        resellerFeeBps: options?.resellerFeeBps ?? null,
      })
      const ctx = risk.get(l.product.id) ?? defaultContext()
      const health = evaluateListingHealth({
        listingId: l.id,
        productId: l.product.id,
        sellingPriceCents: economics.clientPriceCents,
        supplierPriceCents: l.product.basePriceCents,
        netGainCents: economics.netPartnerGainCents,
        refundRisk: ctx.refundRisk,
        refundTrend: ctx.refundTrend,
      })
      return {
        ...health,
        name: l.product.name,
        sellingPriceCents: economics.clientPriceCents,
        supplierPriceCents: l.product.basePriceCents,
        commissionRatePct: economics.commissionRatePct,
        netGainCents: economics.netPartnerGainCents,
      }
    })
    const byId = new Map(rows.map((r) => [r.listingId, r]))
    return sortListingHealth(rows).map((h) => byId.get(h.listingId)!)
  } catch (e) {
    console.warn("[reseller-copilot] listing health unavailable", e instanceof Error ? e.message : e)
    return []
  }
}

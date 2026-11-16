import "server-only"

import { isProductStockMeaningful } from "@/lib/intelligence/opportunities"
import { aggregatePaidOrders, DAY_MS } from "@/lib/intelligence/order-aggregates"
import { loadBasePriceAt, loadPaidOrderFacts } from "@/lib/intelligence/order-facts.server"
import type { ListingPriceChange } from "@/lib/intelligence/price-simulation"
import {
  buildResellerPerformance,
  type ResellerPerformance,
  type ResellerProductInfo,
} from "@/lib/intelligence/reseller-performance"
import { prisma } from "@/lib/prisma"

export const RESELLER_PERIOD_DAYS = 30
/** Orders are read this far back so a price change of the last 90 days has its 30 days "before". */
const FACTS_DAYS = 120
const CHANGES_DAYS = 90
const MAX_LISTED = 500
const MAX_CHANGES = 1000

/** The reseller's OWN listing-price history (scoped by affiliateId). Missing table = empty. */
export async function loadListingPriceChanges(affiliateId: string, since: Date): Promise<ListingPriceChange[]> {
  try {
    const rows = await prisma.listingPriceHistory.findMany({
      where: { affiliateId, effectiveAt: { gte: since } },
      orderBy: { id: "asc" },
      take: MAX_CHANGES,
      select: {
        affiliateProductId: true,
        productId: true,
        variantKey: true,
        priceCents: true,
        previousCents: true,
        source: true,
        effectiveAt: true,
      },
    })
    return rows as ListingPriceChange[]
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn("[listing-price-history]", {
      result: /ListingPriceHistory|P2021|does not exist/i.test(message) ? "table_missing" : "read_failed",
    })
    return []
  }
}

export type ResellerPerformanceResult = ResellerPerformance & {
  generatedAt: string
  periodDays: number
  truncated: boolean
}

/**
 * Loads ONE reseller's own figures (every query is scoped by `affiliateId`; no other reseller's order is ever read):
 * paid orders of the last 60 days, the store's listings, supplier price facts, open disputes and requested returns on
 * that reseller's orders. Read-only.
 */
export async function loadResellerPerformance(args: {
  affiliateId: string
  now?: Date
  limit?: number
}): Promise<ResellerPerformanceResult> {
  const now = args.now ?? new Date()
  const affiliateId = args.affiliateId
  const since60 = new Date(now.getTime() - 2 * RESELLER_PERIOD_DAYS * DAY_MS)
  const since30 = new Date(now.getTime() - RESELLER_PERIOD_DAYS * DAY_MS)

  const [{ facts, truncated }, listings, disputedOrders, returns, listingChanges] = await Promise.all([
    loadPaidOrderFacts({ where: { affiliateId }, since: new Date(now.getTime() - FACTS_DAYS * DAY_MS) }),
    prisma.affiliateProduct.findMany({
      where: { affiliateId },
      orderBy: { updatedAt: "desc" },
      take: MAX_LISTED,
      select: { id: true, productId: true, isListed: true, marginReviewNeeded: true, sellingPriceCents: true },
    }),
    prisma.order.findMany({
      where: { affiliateId, status: { in: ["disputed", "DISPUTED"] } },
      take: 500,
      select: { id: true, productId: true },
    }),
    prisma.orderReturn.findMany({
      where: { status: "REQUESTED", order: { affiliateId } },
      take: 500,
      select: { order: { select: { productId: true } } },
    }),
    loadListingPriceChanges(affiliateId, new Date(now.getTime() - CHANGES_DAYS * DAY_MS)),
  ])
  const aggregates = aggregatePaidOrders(facts, { now, periodDays: RESELLER_PERIOD_DAYS, qualityDays: 2 * RESELLER_PERIOD_DAYS })

  const productIds = [...new Set([...aggregates.keys(), ...listings.map((l) => l.productId)])]
  // Supplier price changes of the whole comparison window (the "attention" list keeps only the last 7 days itself).
  const recentSince = since60
  const [products, priceAtStart, recentChanges, openLedger] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            active: true,
            isDraft: true,
            stock: true,
            listingKind: true,
            hasVariants: true,
            variants: true,
            basePriceCents: true,
            commissionRate: true,
          },
        })
      : Promise.resolve([]),
    loadBasePriceAt(productIds, since30),
    productIds.length
      ? prisma.productPriceHistory
          .findMany({
            where: { productId: { in: productIds }, variantKey: null, recordedAt: { gte: recentSince } },
            orderBy: { recordedAt: "desc" },
            distinct: ["productId"],
            select: { productId: true, priceCents: true, previousCents: true, recordedAt: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
    disputedOrders.length
      ? prisma.processedWebhook.findMany({
          where: { orderId: { in: disputedOrders.map((o) => o.id) }, id: { startsWith: "dispute:" } },
          select: { orderId: true, status: true },
        })
      : Promise.resolve([] as Array<{ orderId: string | null; status: string }>),
  ])

  const listingByProduct = new Map(listings.map((l) => [l.productId, l]))
  const changeByProduct = new Map(
    (recentChanges as Array<{ productId: string; priceCents: number; previousCents: number | null; recordedAt: Date }>).map((c) => [
      c.productId,
      c,
    ])
  )
  const info = new Map<string, ResellerProductInfo>()
  for (const p of products) {
    const listing = listingByProduct.get(p.id)
    const change = changeByProduct.get(p.id)
    info.set(p.id, {
      productId: p.id,
      name: p.name,
      listed: listing?.isListed === true,
      buyable: p.active === true && p.isDraft !== true,
      stock: { units: p.stock, meaningful: isProductStockMeaningful(p) },
      marginReviewNeeded: listing?.marginReviewNeeded === true,
      currentBasePriceCents: p.basePriceCents,
      basePriceAtPeriodStartCents: priceAtStart.get(p.id) ?? null,
      lastPriceChange: change ? { at: change.recordedAt, fromCents: change.previousCents, toCents: change.priceCents } : null,
      listingPriceCents: listing?.sellingPriceCents ?? null,
      commissionPercent: Number(p.commissionRate) || 0,
      listingId: listing?.id ?? null,
    })
  }

  // An order "disputed" counts as an open dispute when the ledger says open, or when no ledger row exists for it (legacy).
  const ledgerOpen = new Set<string>()
  const ledgerAny = new Set<string>()
  for (const r of openLedger) {
    if (!r.orderId) continue
    ledgerAny.add(r.orderId)
    if (r.status === "dispute_open") ledgerOpen.add(r.orderId)
  }
  const openDisputesByProduct = new Map<string, number>()
  for (const o of disputedOrders) {
    if (ledgerOpen.has(o.id) || !ledgerAny.has(o.id)) {
      openDisputesByProduct.set(o.productId, (openDisputesByProduct.get(o.productId) ?? 0) + 1)
    }
  }
  const pendingReturnsByProduct = new Map<string, number>()
  for (const r of returns) {
    const pid = r.order?.productId
    if (pid) pendingReturnsByProduct.set(pid, (pendingReturnsByProduct.get(pid) ?? 0) + 1)
  }

  const factsByProduct = new Map<string, typeof facts>()
  for (const f of facts) {
    const list = factsByProduct.get(f.productId) ?? []
    list.push(f)
    factsByProduct.set(f.productId, list)
  }

  return {
    ...buildResellerPerformance({
      aggregates,
      products: info,
      signals: { openDisputesByProduct, pendingReturnsByProduct },
      now,
      limit: args.limit,
      listingChanges,
      factsByProduct,
      comparisonStart: since60,
      periodStart: since30,
    }),
    generatedAt: now.toISOString(),
    periodDays: RESELLER_PERIOD_DAYS,
    truncated,
  }
}

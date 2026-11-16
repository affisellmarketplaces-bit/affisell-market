import "server-only"

import { isProductStockMeaningful } from "@/lib/intelligence/opportunities"
import { aggregatePaidOrders, DAY_MS } from "@/lib/intelligence/order-aggregates"
import { loadBasePriceAt, loadPaidOrderFacts } from "@/lib/intelligence/order-facts.server"
import {
  buildResellerPerformance,
  PRICE_CHANGE_RECENT_DAYS,
  type ResellerPerformance,
  type ResellerProductInfo,
} from "@/lib/intelligence/reseller-performance"
import { prisma } from "@/lib/prisma"

export const RESELLER_PERIOD_DAYS = 30
const MAX_LISTED = 500

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

  const [{ facts, truncated }, listings, disputedOrders, returns] = await Promise.all([
    loadPaidOrderFacts({ where: { affiliateId }, since: since60 }),
    prisma.affiliateProduct.findMany({
      where: { affiliateId },
      orderBy: { updatedAt: "desc" },
      take: MAX_LISTED,
      select: { productId: true, isListed: true, marginReviewNeeded: true },
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
  ])
  const aggregates = aggregatePaidOrders(facts, { now, periodDays: RESELLER_PERIOD_DAYS, qualityDays: 2 * RESELLER_PERIOD_DAYS })

  const productIds = [...new Set([...aggregates.keys(), ...listings.map((l) => l.productId)])]
  const recentSince = new Date(now.getTime() - PRICE_CHANGE_RECENT_DAYS * DAY_MS)
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

  return {
    ...buildResellerPerformance({
      aggregates,
      products: info,
      signals: { openDisputesByProduct, pendingReturnsByProduct },
      now,
      limit: args.limit,
    }),
    generatedAt: now.toISOString(),
    periodDays: RESELLER_PERIOD_DAYS,
    truncated,
  }
}

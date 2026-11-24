import "server-only"

import { loadListingPresence, loadPresenceForProducts } from "@/lib/listing-presence/presence.server"
import { rebuildPresence } from "@/lib/listing-presence/periods"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import { availableUnits, listingProblem } from "@/lib/reseller-replacement/listing-state"
import { computeResellerNetPerSale } from "@/lib/reseller-copilot/net-per-sale"
import { LOW_STOCK_UNITS } from "@/lib/reseller-copilot/selection"
import {
  buildRetentionMarker,
  decideRetentionAdvice,
  parseRetentionMarker,
  readRetentionHoldoutPct,
  readRetentionMode,
  retentionArm,
  retentionCaseKey,
  retentionMarkerId,
  RETENTION_ACTION,
  RETENTION_TIERS,
  type RetentionAdvice,
  type RetentionConstraint,
  type RetentionMode,
} from "@/lib/reseller-copilot/retention-advisor"
import { evaluateRetention, type RetentionCaseInput, type RetentionEvaluation } from "@/lib/reseller-copilot/retention-advisor-eval"
import { loadReferencePeriods } from "@/lib/reseller-copilot/observation-reference.server"

/**
 * Smart Retention Advisor — server reads (rules: retention-advisor.ts). READ-ONLY on the catalogue, listings, presence
 * history and orders; the only write is the case marker (`AuditLog` action `copilot.retention_advice`, deterministic id
 * `retention-advice:<listing>:<period start day>`, closed payload keys, `skipDuplicates`), once per listing × period.
 * `RETENTION_ADVISOR_MODE=off` (DEFAULT) reads and writes nothing. Never fails the withdrawal: any error = no advice.
 */
const DAY = 86_400_000
export const RETENTION_MAX_ORDERS = 50_000
export const RETENTION_EVAL_MAX_MARKERS = 20_000
export const RETENTION_EVAL_DAYS = 210

function constraintOf(problem: ReturnType<typeof listingProblem>): RetentionConstraint | null {
  switch (problem) {
    case "product_unavailable":
      return "affisell_hold"
    case "awaiting_review":
      return "awaiting_review"
    case "no_commission":
      return "commission"
    case "out_of_stock":
      return "stock"
    default:
      return problem ? "affisell_hold" : null
  }
}

export type RetentionAdviceResult = { mode: RetentionMode; advice: RetentionAdvice | null }

/**
 * The advice for ONE of the reseller's own listings, at the moment it opens the withdrawal confirmation. Another
 * reseller's listing answers null (exactly like a listing without advice). `observe` records the case and shows
 * nothing; `on` shows it unless the case falls in the hold-out (recorded `held_out`); an already recorded case is
 * never shown again (the advice is not repeated within a period on sale).
 */
export async function loadRetentionAdvice(affiliateId: string, listingId: string, now = new Date()): Promise<RetentionAdviceResult | null> {
  const mode = readRetentionMode()
  if (mode === "off") return { mode, advice: null }
  try {
    const listing = await prisma.affiliateProduct.findFirst({
      where: { id: listingId, affiliateId },
      select: {
        id: true,
        isListed: true,
        productId: true,
        sellingPriceCents: true,
        affiliate: { select: { affiliatePlatformFeeBps: true } },
        product: {
          select: {
            categoryId: true, basePriceCents: true, active: true, isDraft: true, tags: true, stock: true, hasVariants: true,
            variants: true, listingKind: true, commissionRate: true, offerMode: true,
          },
        },
      },
    })
    if (!listing) return null
    if (!listing.isListed) return { mode, advice: null }
    const presence = await loadListingPresence(affiliateId, listingId, now)
    if (!presence || !presence.available) return { mode, advice: null }
    const period = presence.history.periods.find((p) => p.ongoing) ?? null
    if (!period?.start || !period.startKnown || period.uncertain) return { mode, advice: null }

    const caseKey = retentionCaseKey(listingId, period.start)
    const markerId = retentionMarkerId(caseKey)
    if (await prisma.auditLog.findUnique({ where: { id: markerId }, select: { id: true } })) return { mode, advice: null }

    const p = listing.product
    const commissionRatePct = Number(p.commissionRate) || 0
    const problem = listingProblem({ ...p, commissionRate: commissionRatePct })
    const constraint = constraintOf(problem)
    const units = availableUnits(p)
    const sellable = constraint == null && (units == null ? (p.listingKind ?? "PHYSICAL").toUpperCase() !== "PHYSICAL" : units > LOW_STOCK_UNITS)
    const net = computeResellerNetPerSale({
      supplierPriceCents: p.basePriceCents,
      commissionRatePct,
      sellingPriceHtCents: listing.sellingPriceCents,
      affiliateFeeBps: listing.affiliate?.affiliatePlatformFeeBps ?? null,
    })
    const ownOrders = await prisma.order.findMany({
      where: { affiliateId, productId: listing.productId, paidAt: { gte: period.start } },
      select: { status: true, paymentSettlementStatus: true },
      take: 50,
    })
    const ordersInPeriod = ownOrders.filter((o) => !isOrderClosedForPayout(o)).length

    const { productPeriods, categoryPeriods } = await loadReferencePeriods({
      productId: listing.productId,
      categoryId: p.categoryId ?? null,
      excludeAffiliateId: affiliateId,
      needCategory: (periods) =>
        new Set(periods.filter((x) => x.firstSaleAfterDays != null).map((x) => x.affiliateId)).size < RETENTION_TIERS.product.minResellers,
      now,
    })

    const decision = decideRetentionAdvice({
      current: { historyAvailable: true, listed: true, start: period.start, startKnown: true, uncertain: false, ordersInPeriod },
      sellable,
      constraints: constraint ? [constraint] : [],
      netPerSaleCents: listing.sellingPriceCents > 0 ? net.netCents : null,
      productPeriods,
      categoryPeriods,
      now,
    })
    if (!decision.advice) return { mode, advice: null }

    const arm = retentionArm(mode, caseKey, readRetentionHoldoutPct())!
    await prisma.auditLog.createMany({
      data: [
        {
          id: markerId,
          action: RETENTION_ACTION,
          entityType: "AffiliateProduct",
          entityId: listingId,
          actorId: affiliateId,
          payload: buildRetentionMarker(arm, decision.advice, { categoryId: p.categoryId ?? null, productId: listing.productId }, period.start),
        },
      ],
      skipDuplicates: true,
    })
    return { mode, advice: arm === "shown" ? decision.advice : null }
  } catch (error) {
    console.error("[retention-advisor] advice_unreadable", error instanceof Error ? error.message : "unknown")
    return { mode, advice: null }
  }
}

/** Founder evaluation (aggregates only, counts per arm / tier / category). null when the advisor is off or unreadable. */
export async function loadRetentionEvaluation(now = new Date()): Promise<RetentionEvaluation | null> {
  if (readRetentionMode() === "off") return null
  try {
    const rows = await prisma.auditLog.findMany({
      where: { action: RETENTION_ACTION, createdAt: { gte: new Date(now.getTime() - RETENTION_EVAL_DAYS * DAY) } },
      select: { entityId: true, actorId: true, createdAt: true, payload: true },
      take: RETENTION_EVAL_MAX_MARKERS + 1,
    })
    if (rows.length > RETENTION_EVAL_MAX_MARKERS) return null
    const markers = rows
      .map((r) => ({ listingId: r.entityId, affiliateId: r.actorId, markedAt: r.createdAt, marker: parseRetentionMarker(r.payload) }))
      .filter((r): r is { listingId: string; affiliateId: string; markedAt: Date; marker: NonNullable<typeof r.marker> } => Boolean(r.listingId && r.affiliateId && r.marker))
    if (markers.length === 0) return evaluateRetention([], now)
    const productIds = [...new Set(markers.map((m) => m.marker.productId))]
    const presence = await loadPresenceForProducts(productIds)
    if (!presence.available || presence.truncated) return null
    const histories = new Map(presence.listings.map((l) => [l.listingId, l.history]))
    const orders = await prisma.order.findMany({
      where: { productId: { in: productIds }, affiliateId: { in: [...new Set(markers.map((m) => m.affiliateId))] }, paidAt: { gte: new Date(now.getTime() - RETENTION_EVAL_DAYS * DAY) } },
      select: { affiliateId: true, productId: true, paidAt: true, quantity: true, status: true, paymentSettlementStatus: true },
      take: RETENTION_MAX_ORDERS + 1,
    })
    if (orders.length > RETENTION_MAX_ORDERS) return null
    const cases: RetentionCaseInput[] = markers.map((m) => ({
      marker: m.marker,
      markedAt: m.markedAt,
      history:
        histories.get(m.listingId) ??
        rebuildPresence({ current: null, events: [], trackingStartedAt: presence.trackingStartedAt }),
      orders: orders
        .filter((o) => o.affiliateId === m.affiliateId && o.productId === m.marker.productId && o.paidAt)
        .map((o) => ({
          affiliateId: o.affiliateId!,
          paidAt: o.paidAt!,
          quantity: Math.max(1, o.quantity ?? 1),
          netCents: 0,
          closed: isOrderClosedForPayout({ status: o.status, paymentSettlementStatus: o.paymentSettlementStatus }),
        })),
    }))
    return evaluateRetention(cases, now)
  } catch (error) {
    console.error("[retention-advisor] evaluation_unreadable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

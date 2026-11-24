import "server-only"

import { loadQualityEvidenceSafe } from "@/lib/commercial-readiness/readiness-context.server"
import { listedDaysInWindow, rebuildPresence } from "@/lib/listing-presence/periods"
import { loadListingPresence, loadPresenceForProducts } from "@/lib/listing-presence/presence.server"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import { availableUnits, listingProblem } from "@/lib/reseller-replacement/listing-state"
import { computeResellerNetPerSale } from "@/lib/reseller-copilot/net-per-sale"
import { loadReferencePeriods } from "@/lib/reseller-copilot/observation-reference.server"
import {
  buildPlanMarker,
  evaluationDue,
  followPlan,
  parsePlanMarker,
  pickReference,
  planArm,
  planAtAdd,
  planEvalMarkerId,
  planMarkerId,
  PLAN_ACTION,
  PLAN_EVAL_ACTION,
  readPlanHoldoutPct,
  readPlanMode,
  referenceOf,
  type PlanDecision,
  type PlanMarker,
  type PlanRecommendation,
  type PlanStatus,
} from "@/lib/reseller-copilot/observation-plan"
import { evaluatePlans, type PlanCaseInput, type PlanEvaluation } from "@/lib/reseller-copilot/observation-plan-eval"
import { LOW_STOCK_UNITS, rankGeneric } from "@/lib/reseller-copilot/selection"
import { loadCandidates } from "@/lib/reseller-copilot/selection.server"

/**
 * Adaptive Product Observation Plan — server reads (rules: observation-plan.ts). READ-ONLY on catalogue, listings,
 * presence and orders; the only writes are the plan marker at the add (`AuditLog` `copilot.observation_plan`, id
 * `observation-plan:<listing>:<day>`, closed keys) and, once, the evaluation marker when an evaluation is first served
 * (`copilot.observation_plan_evaluated`, id `observation-plan-eval:<listing>:<day>`). `OBSERVATION_PLAN_MODE=off`
 * (DEFAULT) reads and writes nothing. Never fails the add or the page that reads it: any error = no plan.
 */
const DAY = 86_400_000
export const PLAN_EVAL_DAYS = 210
export const PLAN_EVAL_MAX_MARKERS = 20_000
export const PLAN_MAX_ORDERS = 50_000
export const PLAN_REVIEW_LOOKBACK_DAYS = 90

async function decideForProduct(viewer: string | null, excludeAffiliateId: string, productId: string, now: Date, feeBps: number | null): Promise<{ decision: PlanDecision; categoryId: string | null } | null> {
  const { candidates } = await loadCandidates(viewer, [productId], now)
  const c = candidates[0]
  if (!c) return { decision: { plan: null, silence: "non_vendable" }, categoryId: null }
  const { ranked, blocked } = rankGeneric([c], feeBps)
  const item = ranked[0] ?? blocked[0]!
  const constraint = item.readiness === "bloque"
  const sellable = !constraint && c.stockKnown && c.stockUnits > LOW_STOCK_UNITS
  const net = item.net.netCents
  if (constraint || !sellable) return { decision: planAtAdd({ sellable, constraint, netPerSaleCents: net, reference: null, now }), categoryId: c.categoryId ?? null }
  const base = planAtAdd({ sellable, constraint, netPerSaleCents: net, reference: null, now })
  if (base.silence === "gain_faible") return { decision: base, categoryId: c.categoryId ?? null }
  const refs = await loadReferencePeriods({
    productId,
    categoryId: c.categoryId ?? null,
    excludeAffiliateId,
    needCategory: (p) => referenceOf(p, "product") == null,
    needGeneral: (p, cat) => referenceOf(p, "product") == null && referenceOf(cat, "category") == null,
    now,
  })
  const reference = pickReference({ product: refs.productPeriods, category: refs.categoryPeriods, general: refs.generalPeriods })
  return { decision: planAtAdd({ sellable, constraint, netPerSaleCents: net, reference, now }), categoryId: c.categoryId ?? null }
}

async function feeOf(affiliateId: string): Promise<number | null> {
  const u = await prisma.user.findUnique({ where: { id: affiliateId }, select: { affiliatePlatformFeeBps: true } })
  return u?.affiliatePlatformFeeBps ?? null
}

/**
 * The plan shown in « Pourquoi ce produit ? », BEFORE the add (nothing written). null unless `on` and the reseller ×
 * product pair is in the shown arm (the hold-out sees nothing — the same arm as after the add).
 */
export async function loadPlanPreview(affiliateId: string, productId: string, now = new Date()): Promise<PlanDecision | null> {
  const mode = readPlanMode()
  if (planArm(mode, affiliateId, productId, readPlanHoldoutPct()) !== "shown") return null
  try {
    return (await decideForProduct(affiliateId, affiliateId, productId, now, await feeOf(affiliateId)))?.decision ?? null
  } catch (error) {
    console.error("[observation-plan] preview_unreadable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

/** Freezes one plan per product the copilot just added and listed. Runs after the response; never throws. */
export async function recordPlansAfterAdd(affiliateId: string, added: ReadonlyArray<{ listingId: string; productId: string }>, now = new Date()): Promise<void> {
  const mode = readPlanMode()
  if (mode === "off" || added.length === 0) return
  try {
    const fee = await feeOf(affiliateId)
    const day = now.toISOString().slice(0, 10)
    const rows = []
    for (const a of added.slice(0, 20)) {
      const d = await decideForProduct(null, affiliateId, a.productId, now, fee).catch(() => null)
      if (!d) continue
      const arm = planArm(mode, affiliateId, a.productId, readPlanHoldoutPct())!
      rows.push({
        id: planMarkerId(a.listingId, day),
        action: PLAN_ACTION,
        entityType: "AffiliateProduct",
        entityId: a.listingId,
        actorId: affiliateId,
        payload: buildPlanMarker(arm, d.decision, { productId: a.productId, categoryId: d.categoryId }, now),
      })
    }
    if (rows.length) await prisma.auditLog.createMany({ data: rows, skipDuplicates: true })
  } catch (error) {
    console.error("[observation-plan] record_failed", error instanceof Error ? error.message : "unknown")
  }
}

export type ListingPlanView = { plannedAt: string; initialHorizonDays: number | null; tier: PlanMarker["tier"]; status: PlanStatus }

/** Status of the most recent plan of ONE of the reseller's own listings. null when off / not shown arm / no plan. */
export async function loadListingPlanStatus(affiliateId: string, listingId: string, now = new Date()): Promise<ListingPlanView | null> {
  if (readPlanMode() !== "on") return null
  try {
    const row = await prisma.auditLog.findFirst({
      where: { action: PLAN_ACTION, entityType: "AffiliateProduct", entityId: listingId, actorId: affiliateId },
      orderBy: { createdAt: "desc" },
      select: { payload: true },
    })
    const marker = parsePlanMarker(row?.payload)
    if (!marker || marker.arm !== "shown") return null
    const listing = await prisma.affiliateProduct.findFirst({
      where: { id: listingId, affiliateId },
      select: {
        productId: true,
        sellingPriceCents: true,
        affiliate: { select: { affiliatePlatformFeeBps: true } },
        product: { select: { categoryId: true, basePriceCents: true, active: true, isDraft: true, tags: true, stock: true, hasVariants: true, variants: true, listingKind: true, commissionRate: true, offerMode: true } },
      },
    })
    if (!listing) return null
    const presence = await loadListingPresence(affiliateId, listingId, now)
    const planned = new Date(marker.plannedAt)
    const p = listing.product
    const commissionRatePct = Number(p.commissionRate) || 0
    const units = availableUnits(p)
    const net = computeResellerNetPerSale({
      supplierPriceCents: p.basePriceCents,
      commissionRatePct,
      sellingPriceHtCents: listing.sellingPriceCents,
      affiliateFeeBps: listing.affiliate?.affiliatePlatformFeeBps ?? null,
    })
    const orders = await prisma.order.findMany({
      where: { affiliateId, productId: listing.productId, paidAt: { gte: planned } },
      select: { paidAt: true, status: true, paymentSettlementStatus: true },
      take: 200,
    })
    const [evidence, refs] = await Promise.all([
      loadQualityEvidenceSafe(),
      loadReferencePeriods({
        productId: listing.productId,
        categoryId: p.categoryId ?? null,
        excludeAffiliateId: affiliateId,
        needCategory: (x) => referenceOf(x, "product") == null,
        needGeneral: (x, cat) => referenceOf(x, "product") == null && referenceOf(cat, "category") == null,
        now,
      }),
    ])
    const { candidates } = await loadCandidates(null, [listing.productId], now, evidence)
    const offer = candidates[0]?.offerMissingMeasured
    const history = presence && presence.available ? presence.history : null
    const ongoing = history?.periods.find((x) => x.ongoing) ?? null
    const durations = history ? listedDaysInWindow(history, planned, now) : null
    const listedAt = (ts: number) =>
      history?.periods.some((x) => x.start && x.start.getTime() <= ts && (x.ongoing || (x.end != null && x.end.getTime() > ts))) ?? false
    const open = orders.filter((o) => o.paidAt && !isOrderClosedForPayout(o))
    const status = followPlan(marker.horizonDays, {
      historyAvailable: Boolean(history),
      listedNow: Boolean(ongoing),
      uncertain: Boolean(ongoing && (ongoing.uncertain || !ongoing.startKnown)),
      listedDaysSincePlan: durations?.listedDays ?? 0,
      unknownDaysSincePlan: durations?.unknownDays ?? 0,
      salesSincePlan: open.filter((o) => listedAt(o.paidAt!.getTime())).length,
      closedSincePlan: orders.length - open.length,
      problem: listingProblem({ ...p, commissionRate: commissionRatePct }),
      lowStock: units != null && units <= LOW_STOCK_UNITS,
      netPerSaleCents: listing.sellingPriceCents > 0 ? net.netCents : null,
      offerGaps: offer == null ? null : offer.length,
      currentReference: pickReference({ product: refs.productPeriods, category: refs.categoryPeriods, general: refs.generalPeriods }),
    })
    if (evaluationDue(status) && status.recommendation) {
      await prisma.auditLog.createMany({
        data: [
          {
            id: planEvalMarkerId(listingId, marker.plannedAt.slice(0, 10)),
            action: PLAN_EVAL_ACTION,
            entityType: "AffiliateProduct",
            entityId: listingId,
            actorId: affiliateId,
            payload: { recommendation: status.recommendation, elapsedDays: status.elapsedDays, horizonDays: status.horizonDays, sales: status.sales },
          },
        ],
        skipDuplicates: true,
      })
    }
    return { plannedAt: marker.plannedAt, initialHorizonDays: marker.horizonDays, tier: marker.tier, status }
  } catch (error) {
    console.error("[observation-plan] status_unreadable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

/** The reseller's plans whose evaluation is due now (for its next-best-action card). Bounded; never throws. */
export async function loadDuePlanReviews(affiliateId: string, now = new Date()): Promise<Array<{ listingId: string; productId: string; productName: string; plannedAt: string; status: PlanStatus }>> {
  if (readPlanMode() !== "on") return []
  try {
    const rows = await prisma.auditLog.findMany({
      where: { action: PLAN_ACTION, actorId: affiliateId, createdAt: { gte: new Date(now.getTime() - PLAN_REVIEW_LOOKBACK_DAYS * DAY) } },
      orderBy: { createdAt: "desc" },
      select: { entityId: true, payload: true },
      take: 100,
    })
    const due = rows
      .map((r) => ({ listingId: r.entityId, marker: parsePlanMarker(r.payload) }))
      .filter((r): r is { listingId: string; marker: PlanMarker } => Boolean(r.listingId && r.marker && r.marker.arm === "shown" && r.marker.horizonDays != null))
      .filter((r) => Date.parse(r.marker.plannedAt) + r.marker.horizonDays! * DAY <= now.getTime())
      .slice(0, 10)
    const names = new Map(
      (await prisma.product.findMany({ where: { id: { in: due.map((d) => d.marker.productId) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]),
    )
    const out = []
    for (const d of due) {
      const view = await loadListingPlanStatus(affiliateId, d.listingId, now)
      if (view && evaluationDue(view.status)) out.push({ listingId: d.listingId, productId: d.marker.productId, productName: names.get(d.marker.productId) ?? "", plannedAt: view.plannedAt, status: view.status })
    }
    return out
  } catch (error) {
    console.error("[observation-plan] reviews_unreadable", error instanceof Error ? error.message : "unknown")
    return []
  }
}

const RECOMMENDATIONS: readonly PlanRecommendation[] = ["conserver", "ameliorer", "surveiller", "reconsiderer", "retirer_ou_remplacer"]

/** Founder evaluation (aggregates only). null when off or unreadable. */
export async function loadPlanEvaluation(now = new Date()): Promise<PlanEvaluation | null> {
  if (readPlanMode() === "off") return null
  try {
    const since = new Date(now.getTime() - PLAN_EVAL_DAYS * DAY)
    const [rows, evals] = await Promise.all([
      prisma.auditLog.findMany({ where: { action: PLAN_ACTION, createdAt: { gte: since } }, select: { entityId: true, actorId: true, payload: true }, take: PLAN_EVAL_MAX_MARKERS + 1 }),
      prisma.auditLog.findMany({ where: { action: PLAN_EVAL_ACTION, createdAt: { gte: since } }, select: { entityId: true, createdAt: true, payload: true }, take: PLAN_EVAL_MAX_MARKERS + 1 }),
    ])
    if (rows.length > PLAN_EVAL_MAX_MARKERS || evals.length > PLAN_EVAL_MAX_MARKERS) return null
    const markers = rows
      .map((r) => ({ listingId: r.entityId, affiliateId: r.actorId, marker: parsePlanMarker(r.payload) }))
      .filter((r): r is { listingId: string; affiliateId: string; marker: PlanMarker } => Boolean(r.listingId && r.affiliateId && r.marker))
    if (markers.length === 0) return evaluatePlans([], now)
    const productIds = [...new Set(markers.map((m) => m.marker.productId))]
    const presence = await loadPresenceForProducts(productIds)
    if (!presence.available || presence.truncated) return null
    const histories = new Map(presence.listings.map((l) => [l.listingId, l.history]))
    const orders = await prisma.order.findMany({
      where: { productId: { in: productIds }, affiliateId: { in: [...new Set(markers.map((m) => m.affiliateId))] }, paidAt: { gte: since } },
      select: { affiliateId: true, productId: true, paidAt: true, status: true, paymentSettlementStatus: true },
      take: PLAN_MAX_ORDERS + 1,
    })
    if (orders.length > PLAN_MAX_ORDERS) return null
    const evalBy = new Map<string, { recommendation: PlanRecommendation; at: Date }>()
    for (const e of evals) {
      const rec = (e.payload as { recommendation?: unknown } | null)?.recommendation
      if (e.entityId && RECOMMENDATIONS.includes(rec as PlanRecommendation)) evalBy.set(e.entityId, { recommendation: rec as PlanRecommendation, at: e.createdAt })
    }
    const cases: PlanCaseInput[] = markers.map((m) => ({
      affiliateId: m.affiliateId,
      marker: m.marker,
      history: histories.get(m.listingId) ?? rebuildPresence({ current: null, events: [], trackingStartedAt: presence.trackingStartedAt }),
      orders: orders
        .filter((o) => o.affiliateId === m.affiliateId && o.productId === m.marker.productId && o.paidAt)
        .map((o) => ({ affiliateId: o.affiliateId!, paidAt: o.paidAt!, quantity: 1, netCents: 0, closed: isOrderClosedForPayout(o) })),
      evaluation: evalBy.get(m.listingId) ?? null,
    }))
    return evaluatePlans(cases, now)
  } catch (error) {
    console.error("[observation-plan] evaluation_unreadable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

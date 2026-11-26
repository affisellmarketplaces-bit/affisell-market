import "server-only"

import { Prisma } from "@prisma/client"

import { applyMarginAutoFixToListing } from "@/lib/affiliate-margin-auto-fix-apply.server"
import { loadAffiliateOpportunityPulsePicks } from "@/lib/affiliate-catalog-opportunity-pulse"
import { computeAffiliateListingMarginCents } from "@/lib/affiliate-listing-margin"
import { cancelAuctionsForListings } from "@/lib/auction-listing-lifecycle"
import { requireMerchantVerifiedForPublish } from "@/lib/merchant-legal/require-merchant-verified"
import { prisma } from "@/lib/prisma"
import { buildActionPlan, type PlannedAction, type PlanListingInput } from "@/lib/reseller-action-plan"
import { loadResellerListingHealth } from "@/lib/reseller-copilot.server"
import { detectCostDrift, detectDemandMomentum, detectTrafficWithoutSales } from "@/lib/reseller-signals"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"
import { revalidateListingCardImage } from "@/lib/revalidate-listing-card-image"

export const MOMENTUM_RECENT_DAYS = 14
export const MOMENTUM_PREVIOUS_DAYS = 56
export const COST_HISTORY_DAYS = 90
const COST_HISTORY_MAX_ROWS = 5_000
/** An applied action can be undone for this long, if nobody changed the listing since. */
export const UNDO_WINDOW_MS = 7 * 86_400_000

export const COPILOT_APPLY_ACTION = "copilot.apply"
export const COPILOT_UNDO_ACTION = "copilot.undo"

type OrderSignals = {
  momentum: Map<string, { recent: number; previous: number }>
  costHistory: Map<string, number[]>
}

/** Paid orders (all resellers: market demand; base SKU only for unit costs). Read-only, never throws. */
async function loadOrderSignals(productIds: string[], now: Date): Promise<OrderSignals> {
  const out: OrderSignals = { momentum: new Map(), costHistory: new Map() }
  if (productIds.length === 0) return out
  const day = 86_400_000
  const recentSince = new Date(now.getTime() - MOMENTUM_RECENT_DAYS * day)
  const previousSince = new Date(recentSince.getTime() - MOMENTUM_PREVIOUS_DAYS * day)
  try {
    const [recent, previous, costs] = await Promise.all([
      prisma.order.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, paidAt: { gte: recentSince, lte: now } },
        _sum: { quantity: true },
      }),
      prisma.order.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, paidAt: { gte: previousSince, lt: recentSince } },
        _sum: { quantity: true },
      }),
      prisma.order.findMany({
        where: {
          productId: { in: productIds },
          paidAt: { gte: new Date(now.getTime() - COST_HISTORY_DAYS * day) },
          variantLabel: null,
          quantity: { gt: 0 },
        },
        select: { productId: true, basePriceCents: true, quantity: true },
        orderBy: { paidAt: "desc" },
        take: COST_HISTORY_MAX_ROWS,
      }),
    ])
    for (const r of recent) out.momentum.set(r.productId, { recent: r._sum.quantity ?? 0, previous: 0 })
    for (const r of previous) {
      const m = out.momentum.get(r.productId) ?? { recent: 0, previous: 0 }
      m.previous = r._sum.quantity ?? 0
      out.momentum.set(r.productId, m)
    }
    for (const o of costs) {
      const list = out.costHistory.get(o.productId) ?? []
      list.push(Math.round(o.basePriceCents / o.quantity))
      out.costHistory.set(o.productId, list)
    }
  } catch (e) {
    console.warn("[reseller-action-plan] order signals unavailable", e instanceof Error ? e.message : e)
  }
  return out
}

export type ResellerActionPlan = { actions: PlannedAction[]; listingsChecked: number; estimated: true }

/** The plan for one reseller. Read-only; an empty plan on any failure. */
export async function loadResellerActionPlan(affiliateId: string, now: Date = new Date()): Promise<ResellerActionPlan> {
  try {
    const user = await prisma.user
      .findUnique({ where: { id: affiliateId }, select: { affiliatePlatformFeeBps: true } })
      .catch(() => null)
    const resellerFeeBps = user?.affiliatePlatformFeeBps ?? null
    const [listings, opportunities] = await Promise.all([
      loadResellerListingHealth(affiliateId, { resellerFeeBps }),
      loadAffiliateOpportunityPulsePicks(affiliateId, 3).catch(() => []),
    ])
    const signals = await loadOrderSignals([...new Set(listings.map((l) => l.productId))], now)
    const inputs: PlanListingInput[] = listings.map((l) => {
      const m = signals.momentum.get(l.productId)
      return {
        listingId: l.listingId,
        productId: l.productId,
        name: l.name,
        isListed: true,
        sellingPriceCents: l.sellingPriceCents,
        supplierPriceCents: l.supplierPriceCents,
        commissionRatePct: l.commissionRatePct,
        resellerFeeBps,
        refundRate: l.guard.expectedRefundRate,
        issues: l.issues,
        status: l.status,
        expectedNetCents: l.guard.expectedNetCents,
        hasVariantPricing: l.hasVariantPricing,
        marginReviewNeeded: l.marginReviewNeeded,
        momentum: m
          ? detectDemandMomentum({
              recentUnits: m.recent,
              recentDays: MOMENTUM_RECENT_DAYS,
              previousUnits: m.previous,
              previousDays: MOMENTUM_PREVIOUS_DAYS,
            })
          : null,
        costDrift: detectCostDrift({
          currentUnitCents: l.supplierPriceCents,
          historyUnitCents: signals.costHistory.get(l.productId) ?? [],
        }),
        traffic: detectTrafficWithoutSales({ clicks: l.clicks, conversions: l.conversions }),
      }
    })
    const actions = buildActionPlan({
      listings: inputs,
      opportunities: opportunities
        .filter((o) => !o.isInStore)
        .map((o) => ({ productId: o.productId, name: o.name, riskAdjustedNetCents: o.riskAdjustedNetCents, score: 0 })),
    })
    return { actions, listingsChecked: listings.length, estimated: true }
  } catch (e) {
    console.warn("[reseller-action-plan] unavailable", e instanceof Error ? e.message : e)
    return { actions: [], listingsChecked: 0, estimated: true }
  }
}

// ─── Apply / undo (one explicit click each, recorded, reversible) ──────────────────────────────────────────────────

/** Everything an action can change — restored as a whole by undo (supplier price-rise flags included). */
type ListingState = {
  sellingPriceCents: number
  marginCents: number
  isListed: boolean
  variantPricing: unknown
  marginReviewNeeded: boolean
  marginReviewVariantKeys: string[]
  marginReviewAt: string | null
  marginReviewAlertHash: string | null
  /** Optimistic-concurrency token: a write only happens if the row still has THIS updatedAt. */
  updatedAt: string
}

export type ApplyResult =
  | { ok: true; auditId: string; action: PlannedAction }
  | { ok: false; reason: "stale" | "not_one_click" | "not_found" | "failed" }

export type UndoResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "already_undone" | "expired" | "changed_since" | "kyc_required" | "failed" }

const stateSelect = {
  sellingPriceCents: true,
  marginCents: true,
  isListed: true,
  variantPricing: true,
  marginReviewNeeded: true,
  marginReviewVariantKeys: true,
  marginReviewAt: true,
  marginReviewAlertHash: true,
  updatedAt: true,
} as const

type StateRow = {
  sellingPriceCents: number
  marginCents: number
  isListed: boolean
  variantPricing: unknown
  marginReviewNeeded: boolean
  marginReviewVariantKeys: string[]
  marginReviewAt: Date | null
  marginReviewAlertHash: string | null
  updatedAt: Date
}

function toState(r: StateRow): ListingState {
  return {
    sellingPriceCents: r.sellingPriceCents,
    marginCents: r.marginCents,
    isListed: r.isListed,
    variantPricing: r.variantPricing ?? null,
    marginReviewNeeded: r.marginReviewNeeded,
    marginReviewVariantKeys: [...(r.marginReviewVariantKeys ?? [])],
    marginReviewAt: r.marginReviewAt ? r.marginReviewAt.toISOString() : null,
    marginReviewAlertHash: r.marginReviewAlertHash ?? null,
    updatedAt: r.updatedAt.toISOString(),
  }
}

async function afterListingChange(affiliateId: string, listingId: string) {
  await revalidateAffiliateShopfront(affiliateId)
  revalidateListingCardImage(listingId)
}

/**
 * Apply ONE prepared action, by id, for the signed-in reseller. The plan is recomputed first: an action that no longer
 * exists (prices moved, already fixed) is refused as `stale`, never applied from an old screen.
 */
export async function applyCopilotAction(args: { affiliateId: string; actionId: string }): Promise<ApplyResult> {
  const plan = await loadResellerActionPlan(args.affiliateId)
  const action = plan.actions.find((a) => a.id === args.actionId)
  if (!action) return { ok: false, reason: "stale" }
  if (action.autonomy !== "one_click" || !action.listingId) return { ok: false, reason: "not_one_click" }
  const listing = await prisma.affiliateProduct.findFirst({
    where: { id: action.listingId, affiliateId: args.affiliateId },
    select: { ...stateSelect, product: { select: { basePriceCents: true } } },
  })
  if (!listing) return { ok: false, reason: "not_found" }
  const before = toState(listing as StateRow)
  // Written only if the row is still exactly what was read (a concurrent edit makes the action stale).
  const unchanged = { id: action.listingId, affiliateId: args.affiliateId, updatedAt: (listing as StateRow).updatedAt }
  try {
    if (action.type === "reprice" && action.suggestedPriceCents != null) {
      const w = await prisma.affiliateProduct.updateMany({
        where: unchanged,
        data: {
          sellingPriceCents: action.suggestedPriceCents,
          marginCents: computeAffiliateListingMarginCents(action.suggestedPriceCents, listing.product.basePriceCents),
        },
      })
      if (w.count !== 1) return { ok: false, reason: "stale" }
    } else if (action.type === "pause") {
      const w = await prisma.affiliateProduct.updateMany({ where: unchanged, data: { isListed: false } })
      if (w.count !== 1) return { ok: false, reason: "stale" }
      await cancelAuctionsForListings([action.listingId])
    } else if (action.type === "fix_margins") {
      const r = await applyMarginAutoFixToListing({ listingId: action.listingId, affiliateId: args.affiliateId })
      if (!r.ok) return { ok: false, reason: r.reason === "not_found" ? "not_found" : "stale" }
    } else {
      return { ok: false, reason: "not_one_click" }
    }
    const afterRow = await prisma.affiliateProduct.findUnique({ where: { id: action.listingId }, select: stateSelect })
    const after = afterRow ? toState(afterRow as StateRow) : null
    const audit = await prisma.auditLog.create({
      data: {
        action: COPILOT_APPLY_ACTION,
        entityType: "AffiliateProduct",
        entityId: action.listingId,
        actorId: args.affiliateId,
        payload: JSON.parse(
          JSON.stringify({ actionId: action.id, type: action.type, reasons: action.reasons, before, after }),
        ),
      },
      select: { id: true },
    })
    await afterListingChange(args.affiliateId, action.listingId)
    console.log("[reseller-copilot]", { result: "applied", actionId: action.id, auditId: audit.id })
    return { ok: true, auditId: audit.id, action }
  } catch (e) {
    console.error("[reseller-copilot] apply failed", {
      actionId: args.actionId,
      error: e instanceof Error ? e.message : e,
    })
    return { ok: false, reason: "failed" }
  }
}

/** Put a listing back exactly as it was before an applied action — only if nobody changed it since. */
export async function undoCopilotAction(args: {
  affiliateId: string
  auditId: string
  now?: Date
}): Promise<UndoResult> {
  const now = args.now ?? new Date()
  const log = await prisma.auditLog.findFirst({
    where: {
      id: args.auditId,
      action: COPILOT_APPLY_ACTION,
      actorId: args.affiliateId,
      entityType: "AffiliateProduct",
    },
  })
  if (!log?.entityId) return { ok: false, reason: "not_found" }
  if (now.getTime() - log.createdAt.getTime() > UNDO_WINDOW_MS) return { ok: false, reason: "expired" }
  const undone = await prisma.auditLog.findFirst({
    where: { action: COPILOT_UNDO_ACTION, entityId: log.entityId, payload: { path: ["undoOf"], equals: log.id } },
    select: { id: true },
  })
  if (undone) return { ok: false, reason: "already_undone" }
  const payload = log.payload as { before: ListingState; after: ListingState } | null
  if (!payload?.before || !payload.after) return { ok: false, reason: "not_found" }
  const current = await prisma.affiliateProduct.findFirst({
    where: { id: log.entityId, affiliateId: args.affiliateId },
    select: stateSelect,
  })
  if (!current) return { ok: false, reason: "not_found" }
  // Any write since the action (by the reseller, a cron, the supplier notifier) changes updatedAt.
  if (current.updatedAt.toISOString() !== payload.after.updatedAt) return { ok: false, reason: "changed_since" }
  if (payload.before.isListed && !current.isListed) {
    const blocked = await requireMerchantVerifiedForPublish(args.affiliateId)
    if (blocked) return { ok: false, reason: "kyc_required" }
  }
  try {
    const b = payload.before
    // Conditional on the row being exactly as the action left it: a concurrent edit between the check above and this
    // write is never overwritten.
    const w = await prisma.affiliateProduct.updateMany({
      where: { id: log.entityId, affiliateId: args.affiliateId, updatedAt: current.updatedAt },
      data: {
        sellingPriceCents: b.sellingPriceCents,
        marginCents: b.marginCents,
        isListed: b.isListed,
        variantPricing: b.variantPricing == null ? Prisma.DbNull : (b.variantPricing as Prisma.InputJsonValue),
        marginReviewNeeded: b.marginReviewNeeded,
        marginReviewVariantKeys: b.marginReviewVariantKeys,
        marginReviewAt: b.marginReviewAt ? new Date(b.marginReviewAt) : null,
        marginReviewAlertHash: b.marginReviewAlertHash,
      },
    })
    if (w.count !== 1) return { ok: false, reason: "changed_since" }
    await prisma.auditLog.create({
      data: {
        action: COPILOT_UNDO_ACTION,
        entityType: "AffiliateProduct",
        entityId: log.entityId,
        actorId: args.affiliateId,
        payload: { undoOf: log.id },
      },
    })
    await afterListingChange(args.affiliateId, log.entityId)
    return { ok: true }
  } catch (e) {
    console.error("[reseller-copilot] undo failed", {
      auditId: args.auditId,
      error: e instanceof Error ? e.message : e,
    })
    return { ok: false, reason: "failed" }
  }
}

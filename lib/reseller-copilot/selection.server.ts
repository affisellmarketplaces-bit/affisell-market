import "server-only"

import { detectEmerging, EMERGING_PRIOR_DAYS, EMERGING_RECENT_DAYS } from "@/lib/strategic-intelligence/emerging"

import { buildAffiliateCatalogProductWhere } from "@/lib/affiliate-catalog-query"
import { quickAddAffiliateListing } from "@/lib/affiliate-quick-add-listing.server"
import { primaryProductImage } from "@/lib/product-images"
import { prisma } from "@/lib/prisma"
import { buildSelection, type SelectionCandidate } from "@/lib/reseller-copilot/selection"
import { mayListOnProduct } from "@/lib/reseller-import/review"
import { effectiveReturnWindowDays, parseReturnWindowDays, RETURN_WINDOW_KEY } from "@/lib/return-terms"
import { explicitSupplierCommissionPct, productHasExplicitSupplierCommission } from "@/lib/supplier-explicit-commission"

/**
 * Reads what the reseller copilot needs (rules: selection.ts). READ-ONLY apart from `addSelection`, which goes through
 * the EXISTING quick add (same listing creation, same publication gates as a manual add) — nothing new is written.
 * Same visibility as the reseller's catalogue (`buildAffiliateCatalogProductWhere`: active, published, exclusivity of
 * other resellers respected, products already in the shop left out).
 */
export const SELECTION_MAX_CANDIDATES = 300
const DAY = 86_400_000

function stockOf(p: { stock: number; hasVariants: boolean; variants: unknown }): { units: number; known: boolean } {
  const obj = p.variants && typeof p.variants === "object" && !Array.isArray(p.variants) ? (p.variants as Record<string, unknown>) : null
  const rows = Array.isArray(obj?.variantRows) ? (obj!.variantRows as unknown[]) : []
  if (rows.length > 0) {
    let sum = 0
    for (const r of rows) {
      const s = r && typeof r === "object" ? (r as { stock?: unknown }).stock : null
      if (typeof s === "number" && Number.isFinite(s)) sum += Math.max(0, Math.round(s))
    }
    return { units: sum, known: true }
  }
  // Variants kept only in the ProductVariant table: checkout does not manage that stock — do not pretend to know it.
  if (p.hasVariants) return { units: 0, known: false }
  return { units: Math.max(0, Math.round(p.stock || 0)), known: true }
}

async function loadCandidates(affiliateId: string, onlyIds?: ReadonlyArray<string>, now = new Date()) {
  const base = await buildAffiliateCatalogProductWhere(new URLSearchParams(), { affiliateId })
  const where = onlyIds ? { AND: [base, { id: { in: [...onlyIds] } }] } : base
  const rows = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      images: true,
      basePriceCents: true,
      commissionRate: true,
      variants: true,
      hasVariants: true,
      offerMode: true,
      stock: true,
      active: true,
      isDraft: true,
      tags: true,
      attributes: { where: { key: RETURN_WINDOW_KEY }, select: { value: true } },
      affiliateProducts: { where: { affiliateId }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: SELECTION_MAX_CANDIDATES,
  })
  const ids = rows.map((r) => r.id)
  const [paid, listed] = ids.length
    ? await Promise.all([
        prisma.order.groupBy({ by: ["productId"], where: { productId: { in: ids }, paidAt: { gte: new Date(now.getTime() - 30 * DAY) } }, _count: { id: true } }),
        prisma.affiliateProduct.groupBy({ by: ["productId"], where: { productId: { in: ids }, isListed: true }, _count: { id: true } }),
      ])
    : [[], []]
  const rising = ids.length ? await loadRising(ids, now) : new Map<string, { recent14d: number; prior42d: number; distinctDays: number }>()
  const paidBy = new Map(paid.map((r) => [r.productId, r._count.id]))
  const listedBy = new Map(listed.map((r) => [r.productId, r._count.id]))
  const candidates: SelectionCandidate[] = rows.map((r) => {
    const stock = stockOf(r)
    return {
      productId: r.id,
      name: r.name,
      imageUrl: primaryProductImage(r.images ?? []) || null,
      basePriceCents: r.basePriceCents,
      commissionRatePct: explicitSupplierCommissionPct({ commissionRate: Number(r.commissionRate) || 0, variants: r.variants }),
      commissionExplicit: productHasExplicitSupplierCommission({ commissionRate: Number(r.commissionRate) || 0, variants: r.variants, offerMode: r.offerMode }),
      stockUnits: stock.units,
      stockKnown: stock.known,
      returnWindowDays: effectiveReturnWindowDays(parseReturnWindowDays(r.attributes[0]?.value)),
      paidOrders30d: paidBy.get(r.id) ?? 0,
      resellersListing: listedBy.get(r.id) ?? 0,
      inMyShop: r.affiliateProducts.length > 0,
      awaitingReview: !mayListOnProduct({ active: r.active, isDraft: r.isDraft, tags: r.tags }),
      rising: rising.get(r.id) ?? null,
    }
  })
  return { candidates, truncated: rows.length >= SELECTION_MAX_CANDIDATES }
}

/**
 * Products whose paid orders accelerate clearly MORE than the marketplace (the cockpit's own `detectEmerging` test —
 * one definition), carried by ≥ 2 resellers (a single reseller's campaign is not a marketplace trend) and spread over
 * ≥ 3 distinct days in the recent window (one bulk day is a one-off, not a trend). Read-only;
 * counts only; a failed read = no trend (never blocks the selection).
 */
export const RISING_MIN_SELLING_RESELLERS = 2
/** Recent orders spread over at least this many distinct days: one bulk day (a single event) is not a trend. */
export const RISING_MIN_DISTINCT_DAYS = 3

async function loadRising(ids: string[], now: Date): Promise<Map<string, { recent14d: number; prior42d: number; distinctDays: number }>> {
  try {
    const recentFrom = new Date(now.getTime() - EMERGING_RECENT_DAYS * DAY)
    const priorFrom = new Date(recentFrom.getTime() - EMERGING_PRIOR_DAYS * DAY)
    const [recent, prior, sellers, marketRecent, marketPrior, recentDates] = await Promise.all([
      prisma.order.groupBy({ by: ["productId"], where: { productId: { in: ids }, paidAt: { gte: recentFrom } }, _count: { id: true } }),
      prisma.order.groupBy({ by: ["productId"], where: { productId: { in: ids }, paidAt: { gte: priorFrom, lt: recentFrom } }, _count: { id: true } }),
      prisma.order.groupBy({ by: ["productId", "affiliateId"], where: { productId: { in: ids }, paidAt: { gte: priorFrom } }, _count: { id: true } }),
      prisma.order.count({ where: { paidAt: { gte: recentFrom } } }),
      prisma.order.count({ where: { paidAt: { gte: priorFrom, lt: recentFrom } } }),
      prisma.order.findMany({
        where: { productId: { in: ids }, paidAt: { gte: recentFrom } },
        select: { productId: true, paidAt: true },
        take: 20_000,
      }),
    ])
    const daysBy = new Map<string, Set<string>>()
    for (const o of recentDates) {
      if (!o.productId || !o.paidAt) continue
      const set = daysBy.get(o.productId) ?? new Set<string>()
      set.add(o.paidAt.toISOString().slice(0, 10))
      daysBy.set(o.productId, set)
    }
    const recentBy = new Map(recent.map((r) => [r.productId as string, r._count.id]))
    const priorBy = new Map(prior.map((r) => [r.productId as string, r._count.id]))
    const sellersBy = new Map<string, number>()
    for (const s of sellers) sellersBy.set(s.productId as string, (sellersBy.get(s.productId as string) ?? 0) + 1)
    const findings = detectEmerging(
      ids.map((id) => ({
        productId: id,
        name: "",
        recent: recentBy.get(id) ?? 0,
        prior: priorBy.get(id) ?? 0,
        sellingResellers: sellersBy.get(id) ?? 0,
      })),
      { recent: marketRecent, prior: marketPrior },
    )
    const out = new Map<string, { recent14d: number; prior42d: number; distinctDays: number }>()
    for (const f of findings) {
      const distinctDays = daysBy.get(f.productId)?.size ?? 0
      if (f.sellingResellers >= RISING_MIN_SELLING_RESELLERS && distinctDays >= RISING_MIN_DISTINCT_DAYS) {
        out.set(f.productId, { recent14d: f.recent, prior42d: f.prior, distinctDays })
      }
    }
    return out
  } catch (error) {
    console.error("[copilot] rising_unreadable", error instanceof Error ? error.message : "unknown")
    return new Map()
  }
}

async function feeBpsOf(affiliateId: string): Promise<number | null> {
  const u = await prisma.user.findUnique({ where: { id: affiliateId }, select: { affiliatePlatformFeeBps: true } })
  return u?.affiliatePlatformFeeBps ?? null
}

export async function loadResellerSelection(affiliateId: string, limit = 12) {
  const [{ candidates, truncated }, feeBps] = await Promise.all([loadCandidates(affiliateId), feeBpsOf(affiliateId)])
  return { ...buildSelection(candidates, { affiliateFeeBps: feeBps, limit }), truncated, affiliateFeeBps: feeBps }
}

export type AddOutcome =
  | { productId: string; ok: true; created: boolean; listed: boolean; publishBlocked: string | null }
  | { productId: string; ok: false; error: string }

/**
 * Adds the products the reseller kept. Each is RE-ASSESSED now (a product may have run out since the page loaded) and a
 * blocked one is refused; the others go through the existing quick add, one by one, so every existing rule applies.
 */
export async function addSelection(affiliateId: string, productIds: ReadonlyArray<string>): Promise<AddOutcome[]> {
  const [{ candidates }, feeBps] = await Promise.all([loadCandidates(affiliateId, productIds), feeBpsOf(affiliateId)])
  const assessed = new Map(buildSelection(candidates, { affiliateFeeBps: feeBps, limit: 50 }).selection.map((s) => [s.productId, s]))
  const out: AddOutcome[] = []
  for (const productId of productIds) {
    const known = candidates.find((c) => c.productId === productId)
    if (!known) {
      out.push({ productId, ok: false, error: "not_in_catalogue" })
      continue
    }
    if (known.inMyShop) {
      out.push({ productId, ok: false, error: "already_in_shop" })
      continue
    }
    if (!assessed.has(productId)) {
      out.push({ productId, ok: false, error: "not_sellable_now" })
      continue
    }
    const r = await quickAddAffiliateListing({ affiliateId, productId })
    out.push(r.ok ? { productId, ok: true, created: r.created, listed: r.listing.isListed, publishBlocked: r.publishBlocked ?? null } : { productId, ok: false, error: r.error })
  }
  return out
}

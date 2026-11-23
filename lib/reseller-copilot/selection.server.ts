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
import { loadQualityEvidenceSafe } from "@/lib/commercial-readiness/readiness-context.server"
import { buildSheetChecklist, type QualityEvidence } from "@/lib/listing-quality/sheet-checklist"
import { QUALITY_RESERVED_KEYS, sheetSignals } from "@/lib/listing-quality/sheet-facts"
import { priceBandOf } from "@/lib/reseller-copilot/opportunity"

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

/**
 * Sheet elements this product's PUBLIC sheet lacks that have an ESTABLISHED marketplace association (same reading as the
 * supplier's quality check: `sheetSignals` + `buildSheetChecklist`). null = no association is established on Affisell,
 * so offer quality can not be judged (said as « not measured », never as weak).
 */
function offerMissingMeasured(
  p: { name: string; description: string | null; images: string[]; listingKind: string | null; stock: number; variants: unknown; customColumns: unknown; deliveryMin: number | null; deliveryMax: number | null; attributes: Array<{ key: string; value: string }> },
  specCount: number,
  evidence: readonly QualityEvidence[],
): Array<{ feature: QualityEvidence["feature"]; lo: number }> | null {
  if (evidence.length === 0) return null
  const signals = sheetSignals({
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
    specCount,
  })
  return buildSheetChecklist(signals, evidence)
    .items.filter((i) => i.state === "missing" && i.evidence)
    .map((i) => ({ feature: i.feature, lo: i.evidence!.lo }))
}

async function loadCandidates(affiliateId: string, onlyIds?: ReadonlyArray<string>, now = new Date(), evidence: readonly QualityEvidence[] = []) {
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
      categoryId: true,
      stock: true,
      active: true,
      isDraft: true,
      tags: true,
      createdAt: true,
      description: true,
      listingKind: true,
      customColumns: true,
      deliveryMin: true,
      deliveryMax: true,
      // Reserved keys only (return window, identity, product safety, stock marker): the public sheet's quality inputs.
      attributes: { where: { key: { in: [...QUALITY_RESERVED_KEYS] } }, select: { key: true, value: true } },
      affiliateProducts: { where: { affiliateId }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: SELECTION_MAX_CANDIDATES,
  })
  const ids = rows.map((r) => r.id)
  const categoryIds = [...new Set(rows.map((r) => r.categoryId).filter((c): c is string => Boolean(c)))]
  const [paid, listed, specCounts, categories] = ids.length
    ? await Promise.all([
        prisma.order.groupBy({ by: ["productId"], where: { productId: { in: ids }, paidAt: { gte: new Date(now.getTime() - 30 * DAY) } }, _count: { id: true }, _sum: { quantity: true } }),
        prisma.affiliateProduct.groupBy({ by: ["productId"], where: { productId: { in: ids }, isListed: true }, _count: { id: true } }),
        prisma.productAttribute
          .groupBy({ by: ["productId"], where: { productId: { in: ids }, key: { notIn: [...QUALITY_RESERVED_KEYS] }, NOT: { value: "" } }, _count: { _all: true } })
          .catch(() => []),
        categoryIds.length ? prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }).catch(() => []) : Promise.resolve([]),
      ])
    : [[], [], [], []]
  const specBy = new Map(specCounts.map((r) => [r.productId, r._count._all]))
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const unitsBy = new Map(paid.map((r) => [r.productId, r._sum.quantity ?? 0]))
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
      returnWindowDays: effectiveReturnWindowDays(parseReturnWindowDays(r.attributes.find((a) => a.key === RETURN_WINDOW_KEY)?.value)),
      paidOrders30d: paidBy.get(r.id) ?? 0,
      resellersListing: listedBy.get(r.id) ?? 0,
      inMyShop: r.affiliateProducts.length > 0,
      awaitingReview: !mayListOnProduct({ active: r.active, isDraft: r.isDraft, tags: r.tags }),
      rising: rising.get(r.id) ?? null,
      categoryId: r.categoryId ?? null,
      categoryName: r.categoryId ? categoryName.get(r.categoryId) ?? null : null,
      units30d: unitsBy.get(r.id) ?? 0,
      ageDays: Math.max(0, Math.floor((now.getTime() - r.createdAt.getTime()) / DAY)),
      offerMissingMeasured: offerMissingMeasured(r, specBy.get(r.id) ?? 0, evidence),
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

/**
 * Categories this reseller REALLY works: those of its live listings and of the products of its paid orders over 90
 * days. Its own activity only; a failed read = no personalisation (the selection stays the general one).
 */
async function loadMyCategories(affiliateId: string, now = new Date()): Promise<Set<string>> {
  try {
    const since = new Date(now.getTime() - 90 * DAY)
    const [listed, sold] = await Promise.all([
      prisma.affiliateProduct.findMany({
        where: { affiliateId, isListed: true },
        select: { product: { select: { categoryId: true } } },
        take: 1000,
      }),
      prisma.order.findMany({
        where: { affiliateId, paidAt: { gte: since } },
        select: { product: { select: { categoryId: true } } },
        take: 2000,
      }),
    ])
    const out = new Set<string>()
    for (const r of [...listed, ...sold]) if (r.product?.categoryId) out.add(r.product.categoryId)
    return out
  } catch (error) {
    console.error("[copilot] categories_unreadable", error instanceof Error ? error.message : "unknown")
    return new Set()
  }
}

/**
 * The middle half of the reseller's OWN live selling prices (HT) — its usual price range. Its own data only; a failed
 * read or fewer than 5 listings = not judged.
 */
async function loadMyPriceBand(affiliateId: string): Promise<{ p25: number; p75: number } | null> {
  try {
    const rows = await prisma.affiliateProduct.findMany({ where: { affiliateId, isListed: true }, select: { sellingPriceCents: true }, take: 1000 })
    return priceBandOf(rows.map((r) => r.sellingPriceCents))
  } catch (error) {
    console.error("[copilot] price_band_unreadable", error instanceof Error ? error.message : "unknown")
    return null
  }
}

export async function loadResellerSelection(affiliateId: string, limit = 12) {
  const evidence = await loadQualityEvidenceSafe()
  const [{ candidates, truncated }, feeBps, myCategories, priceBand] = await Promise.all([
    loadCandidates(affiliateId, undefined, new Date(), evidence),
    feeBpsOf(affiliateId),
    loadMyCategories(affiliateId),
    loadMyPriceBand(affiliateId),
  ])
  return {
    ...buildSelection(candidates, { affiliateFeeBps: feeBps, limit, myCategories, priceBand }),
    truncated,
    affiliateFeeBps: feeBps,
    personalised: myCategories.size > 0,
  }
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

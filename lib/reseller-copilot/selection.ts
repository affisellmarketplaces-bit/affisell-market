/**
 * RESELLER COPILOT — « sélection prête à vendre » (innovation 1 of the 2026-11-19 cycle). Pure.
 *
 * The friction it removes (read in the code, not assumed): to choose what to sell, a reseller had to open product
 * after product, work out by hand what a sale would really pay (the catalogue headline left out Affisell's reseller fee
 * and showed an HT price as the « client price »), and could add a product that can not be sold at all — out of stock,
 * or with no explicit commission, in which case the buyer pays and the line is NOT turned into an order
 * (`commission_not_explicit`, lib/unallocated-line.ts). The copilot does that work for the whole catalogue at once:
 * every candidate gets the REAL net per sale (net-per-sale.ts, pinned to the settlement), a readiness verdict with its
 * reasons, and the observed demand — then the reseller adds the ones it keeps in one action.
 *
 * Every figure says what it is (founder rule): `catalogue` = the supplier's published terms (declared, contractual for
 * the sale); `calcul` = computed from those terms; `observe` = counted in Affisell's own paid orders; nothing is a
 * forecast — no « you will earn X per month » is ever produced.
 */
import { computeResellerNetPerSale, type ResellerNet } from "@/lib/reseller-copilot/net-per-sale"
import type { QualityFeature } from "@/lib/listing-quality/quality-effect"
import { assessOpportunity, categoryStanding, type Opportunity, type RankCriterion } from "@/lib/reseller-copilot/opportunity"

export type Qualification = "catalogue" | "calcul" | "observe" | "suggestion"

export type SelectionCandidate = {
  productId: string
  name: string
  imageUrl: string | null
  basePriceCents: number
  /** Commission % in force for the product line (explicitSupplierCommissionPct, product default). */
  commissionRatePct: number
  /** True when checkout would accept the line (`productHasExplicitSupplierCommission`). */
  commissionExplicit: boolean
  /** Units on hand: product stock, or the sum of the variant rows when the stock lives there. */
  stockUnits: number
  /** False when the stock can not be read reliably (variants only in the table, etc.). */
  stockKnown: boolean
  /** Return window offered (14 = legal minimum). */
  returnWindowDays: number
  /** Paid orders of the product on the whole marketplace, last 30 days. */
  paidOrders30d: number
  /** Resellers that already list it. */
  resellersListing: number
  /** Already in this reseller's shop. */
  inMyShop: boolean
  /** A reseller URL import not yet reviewed by Affisell — can not be listed. */
  awaitingReview: boolean
  /**
   * Demand clearly ACCELERATING on Affisell (`detectEmerging`: exact binomial test against the marketplace's own
   * growth, Bonferroni, size floors) AND carried by ≥ 2 resellers (one reseller's own campaign is not a trend).
   * Absent = not tested / not rising.
   */
  rising?: { recent14d: number; prior42d: number; distinctDays?: number } | null
  /** Taxonomy category of the product (personalisation by the reseller's own categories). */
  categoryId?: string | null
  /** Its category's label (for « strong in its category » — scoped, never generalised). */
  categoryName?: string | null
  /** Units sold on paid orders, marketplace, 30 days (null / absent = not read). */
  units30d?: number | null
  /** Days since the product was created (null / absent = unknown). */
  ageDays?: number | null
  /** Sheet elements missing with an ESTABLISHED marketplace association; null / absent = none established at all. */
  offerMissingMeasured?: ReadonlyArray<{ feature: QualityFeature; lo: number }> | null
}

export type Reason = { code: string; qualification: Qualification }

export type SelectionItem = {
  productId: string
  name: string
  imageUrl: string | null
  readiness: "pret" | "a_verifier" | "bloque"
  reasons: Reason[]
  suggestedPriceHtCents: number
  net: ResellerNet
  demand: { paidOrders30d: number; resellersListing: number; qualification: "observe" }
  /** Observed acceleration (statistically tested), never a forecast. */
  trend: { rising: boolean; recent14d: number; prior42d: number; qualification: "observe" }
  /**
   * Personalisation (founder brief 2026-11-19): `your_categories` = a category this reseller already sells or lists,
   * `discovery` = another one, null = no history to personalise on. Observed from its own activity, never a guess.
   */
  fit: "your_categories" | "discovery" | null
  returnWindowDays: number
  /** « Pourquoi cette opportunité ? » — situation, qualified facts, net breakdown, risks, what is missing, one action. */
  opportunity?: Opportunity
}

/** Same default as the existing quick add (lib/affiliate-catalog-margin-display.ts): supplier price + 30 %. */
export const SUGGESTED_MARKUP_RATE = 0.3
/** A sale paying less than this, net, is not worth the reseller's effort: kept, flagged. */
export const LOW_NET_CENTS = 200
/** Very few units: the product may run out right after it is promoted. */
export const LOW_STOCK_UNITS = 3

export function suggestedPriceHt(basePriceCents: number, markupRate = SUGGESTED_MARKUP_RATE): number {
  const base = Math.max(0, Math.round(basePriceCents))
  return Math.max(base, Math.round(base * (1 + markupRate)))
}

export function assessCandidate(c: SelectionCandidate, affiliateFeeBps: number | null): SelectionItem {
  const price = suggestedPriceHt(c.basePriceCents)
  const net = computeResellerNetPerSale({
    supplierPriceCents: c.basePriceCents,
    commissionRatePct: c.commissionRatePct,
    sellingPriceHtCents: price,
    affiliateFeeBps,
  })
  const blocked: Reason[] = []
  const check: Reason[] = []
  const info: Reason[] = []
  if (c.awaitingReview) blocked.push({ code: "awaiting_affisell_review", qualification: "catalogue" })
  if (!c.commissionExplicit) blocked.push({ code: "no_explicit_commission", qualification: "catalogue" })
  if (c.basePriceCents <= 0) blocked.push({ code: "no_supplier_price", qualification: "catalogue" })
  if (c.stockKnown && c.stockUnits <= 0) blocked.push({ code: "out_of_stock", qualification: "catalogue" })
  if (!c.stockKnown) check.push({ code: "stock_unknown", qualification: "catalogue" })
  else if (c.stockUnits > 0 && c.stockUnits <= LOW_STOCK_UNITS) check.push({ code: "low_stock", qualification: "catalogue" })
  if (blocked.length === 0 && net.netCents < LOW_NET_CENTS) check.push({ code: "low_net_per_sale", qualification: "calcul" })
  if (net.feeIsDefault) info.push({ code: "standard_affisell_fee", qualification: "catalogue" })
  if (c.returnWindowDays > 14) info.push({ code: "extended_returns", qualification: "catalogue" })
  if (c.rising) info.push({ code: "rising_on_affisell", qualification: "observe" })
  if (c.paidOrders30d > 0) info.push({ code: "already_selling", qualification: "observe" })
  else info.push({ code: "no_sales_observed", qualification: "observe" })
  return {
    productId: c.productId,
    name: c.name,
    imageUrl: c.imageUrl,
    readiness: blocked.length ? "bloque" : check.length ? "a_verifier" : "pret",
    reasons: [...blocked, ...check, ...info],
    suggestedPriceHtCents: price,
    net,
    demand: { paidOrders30d: Math.max(0, c.paidOrders30d), resellersListing: Math.max(0, c.resellersListing), qualification: "observe" },
    trend: {
      rising: Boolean(c.rising),
      recent14d: Math.max(0, c.rising?.recent14d ?? 0),
      prior42d: Math.max(0, c.rising?.prior42d ?? 0),
      qualification: "observe",
    },
    returnWindowDays: c.returnWindowDays,
    fit: null,
  }
}

const RANK = { pret: 0, a_verifier: 1, bloque: 2 } as const

function medianNet(items: ReadonlyArray<SelectionItem>): number {
  if (items.length === 0) return 0
  const v = items.map((i) => i.net.netCents).sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid]! : Math.round((v[mid - 1]! + v[mid]!) / 2)
}

/**
 * Personalisation weight: a product in the reseller's own categories is preferred ONLY when its net per sale is within
 * this share of an out-of-category product's — it never passes a product that pays clearly more (no lock-in that costs
 * money). Kept small on purpose and documented.
 */
export const CATEGORY_AFFINITY_TOLERANCE = 0.15
/** Share of the selection kept for other categories (when there are any), so a reseller is never locked in its habits. */
export const DISCOVERY_SHARE = 0.25

/** A rising product is lifted only when it is at least as profitable per sale as the typical selectable product. */
export function risingLifts(item: Pick<SelectionItem, "trend" | "net">, medianNetCents: number): boolean {
  return item.trend.rising && item.net.netCents >= medianNetCents
}

/**
 * The selection: products not yet in the reseller's shop, ready first, then to check; within each, the highest real net
 * per sale, then the most observed demand. Popularity never replaces profitability (founder rule 2026-11-19): a product
 * rising on Affisell is lifted ONLY when its own net per sale is at least the median net of the selectable products
 * (`risingLifts`) — a rising product with a weaker net keeps its badge but its place by net. Blocked products are returned apart (with their reasons) so the
 * reseller understands why a product is missing — never mixed into the selection.
 */
export function buildSelection(
  candidates: ReadonlyArray<SelectionCandidate>,
  opts: { affiliateFeeBps: number | null; limit: number; myCategories?: ReadonlySet<string> | null; priceBand?: { p25: number; p75: number } | null }
): { selection: SelectionItem[]; blocked: SelectionItem[]; considered: number; alreadyInShop: number } {
  const fresh = candidates.filter((c) => !c.inMyShop)
  const personalised = Boolean(opts.myCategories && opts.myCategories.size > 0)
  const assessed = fresh.map((c) => {
    const item = assessCandidate(c, opts.affiliateFeeBps)
    if (personalised) {
      item.fit = c.categoryId && opts.myCategories!.has(c.categoryId) ? "your_categories" : "discovery"
      item.reasons.push({ code: item.fit === "your_categories" ? "in_your_categories" : "discovery", qualification: "observe" })
    }
    return item
  })
  const selectable = assessed.filter((a) => a.readiness !== "bloque")
  const median = medianNet(selectable)
  const lifted = (a: SelectionItem) => (risingLifts(a, median) ? 1 : 0)
  // Net used for ordering only: an in-category product counts its net × (1 + tolerance). Shown figures never change.
  const rankNet = (a: SelectionItem) => (a.fit === "your_categories" ? a.net.netCents * (1 + CATEGORY_AFFINITY_TOLERANCE) : a.net.netCents)
  const compare = (a: SelectionItem, b: SelectionItem) =>
    RANK[a.readiness] - RANK[b.readiness] ||
    lifted(b) - lifted(a) ||
    rankNet(b) - rankNet(a) ||
    b.demand.paidOrders30d - a.demand.paidOrders30d ||
    a.productId.localeCompare(b.productId)
  const ok = selectable.sort(compare)
  /** The FIRST criterion of `compare` that puts `a` before `b` — the ranking explained by itself, nothing added. */
  const rankCriterion = (a: SelectionItem, b: SelectionItem): RankCriterion =>
    RANK[a.readiness] !== RANK[b.readiness]
      ? "readiness"
      : lifted(a) !== lifted(b)
        ? "rising"
        : rankNet(a) !== rankNet(b)
          ? a.net.netCents >= b.net.netCents
            ? "net"
            : "category_affinity"
          : a.demand.paidOrders30d !== b.demand.paidOrders30d
            ? "demand"
            : "tie"
  const limit = Math.max(1, Math.min(50, Math.floor(opts.limit)))
  const picked = ok.slice(0, limit)
  if (personalised) {
    // Discovery quota: keep a share of other categories when they exist, replacing the lowest in-category picks.
    const rest = ok.slice(limit).filter((a) => a.fit === "discovery")
    const quota = Math.min(Math.ceil(limit * DISCOVERY_SHARE), ok.filter((a) => a.fit === "discovery").length)
    while (picked.filter((a) => a.fit === "discovery").length < quota && rest.length > 0) {
      const lastIdx = picked.map((a) => a.fit).lastIndexOf("your_categories")
      if (lastIdx < 0) break
      picked.splice(lastIdx, 1)
      picked.push(rest.shift()!)
    }
    picked.sort(compare)
  }
  // « Pourquoi cette opportunité ? » for every proposed product, from the same candidates (no second read).
  const byId = new Map(fresh.map((c) => [c.productId, c]))
  const names = new Map<string, string>()
  for (const c of candidates) if (c.categoryId && c.categoryName) names.set(c.categoryId, c.categoryName)
  const standing = categoryStanding(
    selectable.map((a) => ({ productId: a.productId, categoryId: byId.get(a.productId)?.categoryId ?? null, paidOrders30d: a.demand.paidOrders30d })),
    names,
  )
  picked.forEach((a, idx) => {
    const c = byId.get(a.productId)!
    a.opportunity = assessOpportunity({
      readiness: a.readiness,
      net: a.net,
      lowNetCents: LOW_NET_CENTS,
      paidOrders30d: a.demand.paidOrders30d,
      units30d: c.units30d ?? null,
      resellersListing: a.demand.resellersListing,
      rising: a.trend.rising,
      stockUnits: c.stockUnits,
      stockKnown: c.stockKnown,
      ageDays: c.ageDays ?? null,
      offerMissingMeasured: c.offerMissingMeasured ?? null,
      category: standing.get(a.productId) ?? null,
      priceBand: opts.priceBand ?? null,
      fit: a.fit,
    })
    const next = picked[idx + 1]
    if (next) a.opportunity.rankedAbove = { productId: next.productId, name: next.name, criterion: rankCriterion(a, next) }
  })
  return {
    selection: picked,
    blocked: assessed.filter((a) => a.readiness === "bloque").slice(0, limit),
    considered: candidates.length,
    alreadyInShop: candidates.length - fresh.length,
  }
}

/** Ids a reseller may add in one action: only items the selection itself proposed (never a blocked product). */
export function sanitizeAddRequest(body: unknown, max = 20): string[] | null {
  const ids = (body && typeof body === "object" ? (body as { productIds?: unknown }).productIds : null) as unknown
  if (!Array.isArray(ids)) return null
  const clean = [...new Set(ids.filter((x): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(x)))]
  if (clean.length === 0 || clean.length > max) return null
  return clean
}

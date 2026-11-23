/**
 * Next best action — one to three actions for ONE account, built from that account's
 * own data (founder brief 2026-11-19). Each action says:
 *  - what to do (`kind` + the product it is about),
 *  - why (`reason`: the diagnosis code it comes from),
 *  - on what data (`evidence`, each figure with its qualification),
 *  - its POTENTIAL impact — what was observed on that product, never a promise
 *    (`impact.qualification` is always `potentiel`),
 *  - its priority (`haute` | `moyenne` | `basse`).
 *
 * No generic advice: an action exists only when a diagnosis on a real product of the
 * account produced it, and two actions never have the same kind or (when another
 * product is available) the same product. Pure, client-safe.
 */
import type { RestockDemandProduct } from "@/lib/restock-watch/restock-demand"
import type { ShopDemandItem } from "@/lib/restock-watch/shop-demand"
import type { QualityFeature, QualityRecommendation } from "@/lib/listing-quality/quality-effect"
import type { HealthClass, HealthIssue, HealthIssueCode, HealthReport } from "@/lib/supplier-catalog-health/diagnose"
import type { ProductReadinessSummary } from "@/lib/commercial-readiness/catalog-readiness"

export type ActionPriority = "haute" | "moyenne" | "basse"
export type Qualified = { value: string | number | boolean | null; qualification: "fiche" | "observe" | "affisell" | "calcul" }

export type NextAction = {
  /** Stable while the situation lasts (kind + product), so a UI can remember a dismissal. */
  key: string
  kind:
    | "fix_blocage"
    | "answer_restock_demand"
    | "resolve_availability"
    | "promote_to_resellers"
    | "publish_draft"
    | "complete_sheet"
    | "fix_shop_listing"
    | "review_profit_drop"
    | "add_ready_product"
    | "answer_shop_demand"
    | "prepare_listing"
  productId: string
  productName: string
  reason: string
  priority: ActionPriority
  evidence: Record<string, Qualified>
  impact: {
    qualification: "potentiel"
    /** Observed on THIS product over 30 days — the scale of what is at stake, not a forecast. */
    paidOrders30d?: number
    resellersListing?: number
    netPerSaleCents?: number
    netChangeCents?: number
    /** Distinct buyers who explicitly asked to be told when THIS variant is back (≥ 3) — demand, not a sales forecast. */
    waitingBuyers?: number
    /**
     * Marketplace AGGREGATE association for the sheet element this action is about (same category, price band, age;
     * ≥ 5 suppliers each side): sales per day in a shop with the element ÷ without, and the interval's lower bound.
     * An association, never a promise.
     */
    qualityRatio?: number
    qualityRatioLow?: number
  }
  /** The exact variant the action is about (its label in the supplier's own sheet), when it is about one. */
  variantLabel?: string
  /**
   * `prepare_listing`: the commercial-readiness engine's ONE next fix for this saved product (same engine as the
   * supplier's forms). `live` = worded for a product already on sale; `basis` = the rule that decides it.
   */
  readiness?: { code: string; level: "bloquant" | "prioritaire"; basis: string; feature?: QualityFeature; live?: boolean }
  /** Where the account acts. */
  href: string
}

const PRIORITY_BY_CLASS: Record<HealthClass, ActionPriority> = {
  blocage: "haute",
  anomalie: "moyenne",
  avertissement: "moyenne",
  recommandation: "basse",
}

const SUPPLIER_KIND: Partial<Record<HealthIssueCode, NextAction["kind"]>> = {
  // held_by_affisell / hold_unverifiable are deliberately absent: the supplier can not act on them.
  price_missing: "fix_blocage",
  commission_not_explicit: "fix_blocage",
  safety_blocks_publication: "fix_blocage",
  stock_unconfirmed: "resolve_availability",
  out_of_stock: "resolve_availability",
  low_stock: "resolve_availability",
  stock_cover_short: "resolve_availability",
  stock_nominal: "resolve_availability",
  variant_stock_mismatch: "resolve_availability",
  variant_stock_untracked: "resolve_availability",
  variant_rows_indistinct: "resolve_availability",
  no_reseller: "promote_to_resellers",
  draft_ready: "publish_draft",
  no_photo: "complete_sheet",
  no_category: "complete_sheet",
  duplicate_name: "complete_sheet",
  delivery_window_inverted: "complete_sheet",
  safety_data_missing: "complete_sheet",
  paused_but_listed: "complete_sheet",
  listed_no_sales: "complete_sheet",
  few_photos: "complete_sheet",
  short_description: "complete_sheet",
  no_gtin: "complete_sheet",
}

/** low_stock / few_photos and the like only become an ACTION when the product has real demand — otherwise it is noise. */
const NEEDS_DEMAND = new Set<HealthIssueCode>(["low_stock", "listed_no_sales", "few_photos", "short_description", "no_gtin"])

function hrefForSupplier(i: HealthIssue, kind: NextAction["kind"]): string {
  if (kind === "promote_to_resellers") return "/dashboard/supplier/invite-affiliate"
  return `/dashboard/supplier/products/${encodeURIComponent(i.productId)}/edit`
}

function pickDistinct<T extends { kind: string; productId: string; score: number }>(cands: T[], max: number): T[] {
  const sorted = [...cands].sort((a, b) => b.score - a.score)
  const out: T[] = []
  const kinds = new Set<string>()
  const products = new Set<string>()
  // first pass: distinct kind AND distinct product
  for (const c of sorted) {
    if (out.length >= max) break
    if (kinds.has(c.kind) || products.has(c.productId)) continue
    out.push(c)
    kinds.add(c.kind)
    products.add(c.productId)
  }
  // second pass: distinct kind only (a product may carry two different actions when nothing else exists)
  for (const c of sorted) {
    if (out.length >= max) break
    if (kinds.has(c.kind)) continue
    out.push(c)
    kinds.add(c.kind)
  }
  return out
}

/**
 * « N buyers are waiting for Noir / M » — from the supplier signal (≥ 3 distinct buyers, active requests on a variant
 * still sold out; computed on read, so it disappears as soon as the variant is back or the requests lapse). One action
 * for the most-awaited variant; the key names the variant, so a UI dismissal holds while that same demand lasts.
 * It takes the place of the generic « resolve availability » action on the same product (same fix, sharper reason).
 */
export function restockDemandCandidates(demand: ReadonlyArray<RestockDemandProduct>): Array<NextAction & { score: number }> {
  const out: Array<NextAction & { score: number }> = []
  for (const p of demand) {
    for (const v of p.variants) {
      if (v.buyers < 3) continue
      out.push({
        key: `answer_restock_demand:${p.productId}:${v.variantKey}`,
        kind: "answer_restock_demand",
        productId: p.productId,
        productName: p.productName,
        variantLabel: v.variantLabel,
        reason: "restock_demand",
        priority: "haute",
        evidence: {
          variant: { value: v.variantLabel, qualification: "fiche" },
          waitingBuyers: { value: v.buyers, qualification: "observe" },
        },
        impact: { qualification: "potentiel", waitingBuyers: v.buyers },
        href: `/dashboard/supplier/products/${encodeURIComponent(p.productId)}/edit`,
        // Above any availability diagnosis: explicit buyers waiting is the most concrete reason to act.
        score: 1_000_000 + v.buyers,
      })
    }
  }
  return out
}

/** Catalogue-health codes that ARE a sheet element the quality measure judges. */
const ISSUE_FEATURE: Partial<Record<HealthIssueCode, QualityFeature>> = {
  few_photos: "photos_3plus",
  short_description: "description_200plus",
  no_gtin: "gtin_valid",
}
/** Sheet elements the health report does not diagnose: they become an action ONLY on measured evidence. */
const EVIDENCE_ONLY_FEATURES: ReadonlySet<QualityFeature> = new Set([
  "title_precise",
  "specs_3plus",
  "photos_5plus",
  "brand_declared",
  "delivery_declared",
  "return_extended",
])

/** Readiness codes that are about the product's stock / holds: the availability actions already carry them. */
const READINESS_AVAILABILITY_CODES = new Set(["stock_missing", "stock_unconfirmed", "stock_low", "held_by_affisell", "hold_unverifiable"])
/** Health actions about the SHEET: replaced on a product by its readiness next fix (the engine already chose among them). */
const SHEET_KINDS = new Set<NextAction["kind"]>(["fix_blocage", "complete_sheet"])

/**
 * The commercial-readiness engine's next fix of a saved product, as an action: a blocker on any product (a draft the
 * supplier is preparing, or a live one), a priority only on a product with observed demand or a draft. Score = the
 * health report's own scale (blocker 1000 / priority 100 × observed demand), so both kinds of action compare honestly.
 * Never an Affisell decision (not fixable), never a recommendation (the quality evidence path handles those).
 */
export function readinessCandidates(readiness: ReadonlyArray<ProductReadinessSummary>): Array<NextAction & { score: number }> {
  const out: Array<NextAction & { score: number }> = []
  for (const r of readiness) {
    const f = r.nextFix
    if (!f || f.level === "recommande" || READINESS_AVAILABILITY_CODES.has(f.code)) continue
    const demand = r.demand.paidOrders30d + r.demand.resellersListing
    if (f.level === "prioritaire" && r.stage === "live" && demand === 0) continue
    const weight = 1 + 3 * r.demand.paidOrders30d + r.demand.resellersListing
    out.push({
      key: `prepare_listing:${r.productId}:${f.code}`,
      kind: "prepare_listing",
      productId: r.productId,
      productName: r.productName,
      reason: "readiness_next_fix",
      priority: f.level === "bloquant" ? "haute" : "moyenne",
      readiness: { code: f.code, level: f.level, basis: f.basis, ...(f.feature ? { feature: f.feature } : {}), ...(f.live ? { live: true } : {}) },
      evidence: {
        stage: { value: r.stage, qualification: "fiche" },
        verdict: { value: r.verdict, qualification: "affisell" },
        paidOrders30d: { value: r.demand.paidOrders30d, qualification: "observe" },
        resellersListing: { value: r.demand.resellersListing, qualification: "observe" },
      },
      impact: { qualification: "potentiel", paidOrders30d: r.demand.paidOrders30d, resellersListing: r.demand.resellersListing },
      href: `/dashboard/supplier/products/${encodeURIComponent(r.productId)}/edit`,
      score: (f.level === "bloquant" ? 1000 : 100) * weight,
    })
  }
  return out
}

export function supplierNextActions(
  report: HealthReport,
  max = 3,
  restockDemand: ReadonlyArray<RestockDemandProduct> = [],
  quality: ReadonlyArray<QualityRecommendation> = [],
  readiness: ReadonlyArray<ProductReadinessSummary> = []
): NextAction[] {
  const ready = readinessCandidates(readiness)
  const cands: Array<NextAction & { score: number }> = [...restockDemandCandidates(restockDemand), ...ready]
  const qualityBy = new Map(quality.map((q) => [`${q.productId}\u0000${q.feature}`, q]))
  const demandProducts = new Set(restockDemandCandidates(restockDemand).map((c) => c.productId))
  const readinessProducts = new Set(ready.map((c) => c.productId))
  for (const i of report.issues) {
    const kind = SUPPLIER_KIND[i.code]
    if (!kind) continue
    if (kind === "resolve_availability" && demandProducts.has(i.productId)) continue
    // ONE next fix per product for its sheet: the readiness engine's, never a second, competing one.
    if (SHEET_KINDS.has(kind) && readinessProducts.has(i.productId)) continue
    const demand = i.demand.paidOrders30d + i.demand.resellersListing
    if (NEEDS_DEMAND.has(i.code) && demand === 0) continue
    const evidence: Record<string, Qualified> = {}
    for (const [k, v] of Object.entries(i.evidence)) evidence[k] = { value: v, qualification: i.source }
    evidence.paidOrders30d = { value: i.demand.paidOrders30d, qualification: "observe" }
    evidence.resellersListing = { value: i.demand.resellersListing, qualification: "observe" }
    // A sheet gap with an ESTABLISHED association on Affisell gets the evidence and one priority step (never above « moyenne »).
    const feature = ISSUE_FEATURE[i.code]
    const q = feature ? qualityBy.get(`${i.productId}\u0000${feature}`) : undefined
    cands.push({
      key: `${kind}:${i.productId}`,
      kind,
      productId: i.productId,
      productName: i.productName,
      reason: i.code,
      priority: q && PRIORITY_BY_CLASS[i.cls] === "basse" ? "moyenne" : PRIORITY_BY_CLASS[i.cls],
      evidence,
      impact: {
        qualification: "potentiel",
        paidOrders30d: i.demand.paidOrders30d,
        resellersListing: i.demand.resellersListing,
        ...(q ? { qualityRatio: q.adjustedRatio, qualityRatioLow: q.lo } : {}),
      },
      href: hrefForSupplier(i, kind),
      score: q ? i.impactScore * q.lo : i.impactScore,
    })
  }
  // Elements the health report does not diagnose: an action only with measured evidence AND some distribution.
  for (const q of quality) {
    if (!EVIDENCE_ONLY_FEATURES.has(q.feature) || q.resellersListing + q.paidOrders90d === 0) continue
    if (readinessProducts.has(q.productId)) continue
    cands.push({
      key: `complete_sheet:${q.productId}`,
      kind: "complete_sheet",
      productId: q.productId,
      productName: q.productName,
      reason: `quality_${q.feature}`,
      priority: "moyenne",
      evidence: {
        resellersListing: { value: q.resellersListing, qualification: "observe" },
        qualityRatioLow: { value: Math.round(q.lo * 10) / 10, qualification: "calcul" },
      },
      impact: { qualification: "potentiel", resellersListing: q.resellersListing, qualityRatio: q.adjustedRatio, qualityRatioLow: q.lo },
      href: `/dashboard/supplier/products/${encodeURIComponent(q.productId)}/edit`,
      score: 100 * (q.lo - 1) * (1 + q.resellersListing + q.paidOrders90d),
    })
  }
  return pickDistinct(cands, Math.max(1, Math.min(3, max))).map(({ score: _s, ...a }) => a)
}

// ---------------------------------------------------------------------------
// Reseller

export type ShopListingState = {
  listingId: string
  productId: string
  name: string
  /** Why buyers can not buy it right now (null = sellable). */
  problem: "out_of_stock" | "product_unavailable" | "awaiting_review" | "no_commission" | null
  paidOrders30d: number
}

export type ProfitDrop = {
  alertId: string
  productId: string
  name: string
  primaryCause: string
  netChangeCents: number
}

export type ReadyProduct = {
  productId: string
  name: string
  netPerSaleCents: number
  paidOrders30d: number
  resellersListing: number
}

const DROP_CAUSES = new Set([
  "volume_down",
  "your_price_down",
  "collected_price_down",
  "supplier_price_up",
  "commission_down",
  "fees_up",
  "refunds_up",
  "disputes_up",
])

/** The shop page where the reseller sees the waited variant's demand and the alternatives (replace page, demand mode). */
export function shopDemandHref(listingId: string, variantKey: string): string {
  return `/dashboard/affiliate/products/${encodeURIComponent(listingId)}/replace?variant=${encodeURIComponent(variantKey)}`
}

export function resellerNextActions(
  input: { listings: ShopListingState[]; drops: ProfitDrop[]; ready: ReadyProduct[]; shopDemand?: ReadonlyArray<ShopDemandItem> },
  max = 3
): NextAction[] {
  const cands: Array<NextAction & { score: number }> = []
  // « 5 buyers of your shop are waiting for Noir / M »: one action per waited variant of the shop (same key while that
  // demand lasts, gone with it). A listing that can not be bought at all keeps its own « fix » action (scored higher),
  // so the same product is not recommended twice for overlapping reasons.
  const unsellable = new Set(input.listings.filter((l) => l.problem).map((l) => l.listingId))
  for (const d of input.shopDemand ?? []) {
    if (d.buyers < 3 || unsellable.has(d.listingId)) continue
    cands.push({
      key: `answer_shop_demand:${d.listingId}:${d.variantKey}`,
      kind: "answer_shop_demand",
      productId: d.productId,
      productName: d.productName,
      variantLabel: d.variantLabel,
      reason: "shop_restock_demand",
      priority: "haute",
      evidence: {
        variant: { value: d.variantLabel, qualification: "fiche" },
        waitingBuyers: { value: d.buyers, qualification: "observe" },
      },
      impact: { qualification: "potentiel", waitingBuyers: d.buyers },
      href: shopDemandHref(d.listingId, d.variantKey),
      score: 2500 + d.buyers,
    })
  }
  for (const l of input.listings) {
    if (!l.problem) continue
    cands.push({
      key: `fix_shop_listing:${l.productId}`,
      kind: "fix_shop_listing",
      productId: l.productId,
      productName: l.name,
      reason: `shop_${l.problem}`,
      priority: "haute",
      evidence: {
        problem: { value: l.problem, qualification: l.problem === "out_of_stock" ? "fiche" : "affisell" },
        paidOrders30d: { value: l.paidOrders30d, qualification: "observe" },
      },
      impact: { qualification: "potentiel", paidOrders30d: l.paidOrders30d },
      href: `/dashboard/affiliate/products/${encodeURIComponent(l.listingId)}/replace`,
      // a listing buyers see but can not buy is fixed first; weighted by what it used to sell
      score: 3000 + 100 * l.paidOrders30d,
    })
  }
  for (const d of input.drops) {
    if (!(d.netChangeCents < 0)) continue
    cands.push({
      key: `review_profit_drop:${d.productId}`,
      kind: "review_profit_drop",
      productId: d.productId,
      productName: d.name,
      reason: `drop_${DROP_CAUSES.has(d.primaryCause) ? d.primaryCause : "other"}`,
      priority: d.netChangeCents <= -5_000 ? "haute" : "moyenne",
      evidence: { netChangeCents: { value: d.netChangeCents, qualification: "observe" }, cause: { value: d.primaryCause, qualification: "calcul" } },
      impact: { qualification: "potentiel", netChangeCents: d.netChangeCents },
      href: "/dashboard/affiliate/opportunities",
      score: 2000 + Math.min(100_000, -d.netChangeCents) / 10,
    })
  }
  for (const r of input.ready) {
    if (!(r.netPerSaleCents > 0)) continue
    cands.push({
      key: `add_ready_product:${r.productId}`,
      kind: "add_ready_product",
      productId: r.productId,
      productName: r.name,
      reason: "ready_to_sell",
      priority: r.paidOrders30d > 0 ? "moyenne" : "basse",
      evidence: {
        netPerSaleCents: { value: r.netPerSaleCents, qualification: "calcul" },
        paidOrders30d: { value: r.paidOrders30d, qualification: "observe" },
        resellersListing: { value: r.resellersListing, qualification: "observe" },
      },
      impact: { qualification: "potentiel", netPerSaleCents: r.netPerSaleCents, paidOrders30d: r.paidOrders30d },
      href: "/dashboard/affiliate/catalog",
      score: 1000 + r.netPerSaleCents / 100 + 10 * r.paidOrders30d,
    })
  }
  return pickDistinct(cands, Math.max(1, Math.min(3, max))).map(({ score: _s, ...a }) => a)
}

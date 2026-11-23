/**
 * Does the quality of a product sheet go with better sales on Affisell? (founder brief 2026-11-20, first version)
 *
 * READ-ONLY, pure, no AI call. It does NOT show that a better sheet CAUSES sales: products are not assigned their
 * sheet at random. What it can show is an ASSOCIATION, measured after taking out what Affisell can take out:
 *  - CATEGORY (taxonomy root) and PRICE BAND — compared only inside the same root × band × product-age stratum;
 *  - EXPOSURE — sales are counted per day of presence in a live reseller listing (the « listing-day »), so a product in
 *    ten shops is not credited for being in ten shops;
 *  - SEASONALITY — every product is read over the SAME window;
 *  - AGE — product-age band in the stratum.
 * What it can NOT take out (written in every report, `LIMITS`): the traffic and visibility each shop brings (not
 * recorded), PDP views (only the Pulse feed writes a « view » — not representative), add-to-cart history (the cart
 * keeps only its current content), the stock HISTORY (only today's state is known), the reseller's own price, and
 * everything that makes a supplier who writes good sheets also good at other things (a careful supplier).
 *
 * Method: for each sheet element, a Mantel–Haenszel rate ratio of paid orders per listing-day (with the element vs
 * without), across the strata where both groups exist, with the Greenland–Robins variance, Bonferroni-corrected
 * over the elements tested. Verdicts: `positive` / `negative` only when the WHOLE interval is on one side of 1 and the
 * volume floors are met (products and SUPPLIERS on each side — a pool carried by one or two suppliers is neither
 * representative nor anonymous); otherwise `unclear` or `insufficient`. The crude (unadjusted) ratio is shown beside
 * it, so the reader sees how much the comparison inside strata changed it.
 */

export const QUALITY_WINDOW_DAYS = 90
const DAY = 86_400_000

/** Volume floors — below them nothing is concluded (a first number is not a finding). */
export const QUALITY_MIN_PRODUCTS_EACH_SIDE = 20
export const QUALITY_MIN_SUPPLIERS_EACH_SIDE = 5
export const QUALITY_MIN_ORDERS = 30
export const QUALITY_MIN_STRATA = 2

export const QUALITY_FEATURES = [
  "photos_3plus",
  "photos_5plus",
  "title_precise",
  "description_200plus",
  "specs_3plus",
  "variants_distinct",
  "gtin_valid",
  "brand_declared",
  "delivery_declared",
  "return_extended",
  "safety_complete",
  "stock_confirmed",
] as const
export type QualityFeature = (typeof QUALITY_FEATURES)[number]

/** What the analysis needs of one product — every value read from the sheet as it is TODAY. */
export type QualityProduct = {
  id: string
  supplierId: string
  rootCategoryId: string | null
  basePriceCents: number
  createdAt: Date
  imageCount: number
  title: string
  descriptionText: string
  /** Non-reserved attribute rows (specifications), compliance / identity keys excluded. */
  specCount: number
  /** null = no variants; otherwise whether every row can be told apart under the shared rule. */
  variantsDistinct: boolean | null
  gtinValid: boolean
  brandDeclared: boolean
  deliveryMin: number | null
  deliveryMax: number | null
  returnWindowDays: number
  /** null = product-safety data not applicable (non-physical). */
  safetyComplete: boolean | null
  physical: boolean
  stock: number
  stockUnconfirmed: boolean
}

export type QualityExposure = {
  /** Σ over live reseller listings of the days present in the window (an ESTIMATE: past un-listings are not recorded). */
  listingDays: number
  paidOrders: number
  units: number
  /** Paid orders since closed (refunded / cancelled) — counted apart, never subtracted from the sales. */
  closedOrders: number
}

export function titleIsPrecise(title: string): boolean {
  const t = title.trim()
  const words = t.split(/\s+/).filter(Boolean)
  const letters = t.replace(/[^\p{L}]/gu, "")
  const shouting = letters.length >= 8 && letters === letters.toUpperCase()
  return t.length >= 15 && t.length <= 150 && words.length >= 3 && !shouting
}

/** Is the element applicable to this product, and does the sheet have it? `null` = not applicable. */
export function featureValue(f: QualityFeature, p: QualityProduct): boolean | null {
  switch (f) {
    case "photos_3plus":
      return p.imageCount >= 3
    case "photos_5plus":
      return p.imageCount >= 5
    case "title_precise":
      return titleIsPrecise(p.title)
    case "description_200plus":
      return p.descriptionText.trim().length >= 200
    case "specs_3plus":
      return p.specCount >= 3
    case "variants_distinct":
      return p.variantsDistinct
    case "gtin_valid":
      return p.physical ? p.gtinValid : null
    case "brand_declared":
      return p.brandDeclared
    case "delivery_declared":
      return p.physical ? p.deliveryMax != null && p.deliveryMax > 0 && (p.deliveryMin == null || p.deliveryMin <= p.deliveryMax) : null
    case "return_extended":
      return p.physical ? p.returnWindowDays > 14 : null
    case "safety_complete":
      return p.safetyComplete
    case "stock_confirmed":
      return p.physical ? p.stock > 0 && !p.stockUnconfirmed : null
  }
}

/** Fixed price bands (EUR, supplier price): stable from one run to the next, independent of the sample. */
export function priceBand(cents: number): string {
  if (cents < 1500) return "lt15"
  if (cents < 4000) return "15_40"
  if (cents < 10000) return "40_100"
  return "gte100"
}

export function ageBand(createdAt: Date, now: Date): string {
  const d = (now.getTime() - createdAt.getTime()) / DAY
  return d < 30 ? "lt30" : d < 90 ? "30_90" : "gte90"
}

export function stratumOf(p: QualityProduct, now: Date): string {
  return `${p.rootCategoryId ?? "none"}|${priceBand(p.basePriceCents)}|${ageBand(p.createdAt, now)}`
}

function normalQuantile(p: number): number {
  // Acklam's rational approximation (|error| < 1.2e-9), enough for interval bounds.
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const pl = 0.02425
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  }
  if (p > 1 - pl) return -normalQuantile(1 - p)
  const q = p - 0.5
  const r = q * q
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
}

/** Two-sided Bonferroni z for `tests` comparisons at 5 % family-wise. */
export function bonferroniZ(tests: number): number {
  return normalQuantile(1 - 0.05 / (2 * Math.max(1, Math.floor(tests))))
}

export type FeatureVerdict = "positive" | "negative" | "unclear" | "insufficient"

export type FeatureEffect = {
  feature: QualityFeature
  /** MEASURED facts (counts over the window). */
  measured: {
    productsWith: number
    productsWithout: number
    suppliersWith: number
    suppliersWithout: number
    ordersWith: number
    ordersWithout: number
    unitsWith: number
    unitsWithout: number
    closedWith: number
    closedWithout: number
    informativeStrata: number
  }
  /** ESTIMATES: exposure is estimated, so every rate built on it is too. */
  estimated: {
    listingDaysWith: number
    listingDaysWithout: number
    /** Orders per 100 listing-days, crude (no adjustment). */
    crudeRateWith: number | null
    crudeRateWithout: number | null
    crudeRatio: number | null
    /** Mantel–Haenszel ratio inside root × price band × age strata, and its Bonferroni interval. */
    adjustedRatio: number | null
    lo: number | null
    hi: number | null
    /** Share of paid orders later closed (refunded / cancelled), crude — NOT adjusted, not judged. */
    closedShareWith: number | null
    closedShareWithout: number | null
  }
  verdict: FeatureVerdict
  /** Why the verdict is what it is, in codes (texts are the reader's). */
  reasons: string[]
}

type Cell = { products: Set<string>; suppliers: Set<string>; orders: number; units: number; closed: number; days: number }
const emptyCell = (): Cell => ({ products: new Set(), suppliers: new Set(), orders: 0, units: 0, closed: 0, days: 0 })

/**
 * One feature, Mantel–Haenszel over strata. Products without exposure (no listing-day in the window) are left out:
 * a product nobody could buy says nothing about its sheet.
 */
export function measureFeature(
  feature: QualityFeature,
  products: ReadonlyArray<QualityProduct>,
  exposure: ReadonlyMap<string, QualityExposure>,
  now: Date,
  z: number
): FeatureEffect {
  const strata = new Map<string, { with: Cell; without: Cell }>()
  const all = { with: emptyCell(), without: emptyCell() }
  for (const p of products) {
    const v = featureValue(feature, p)
    const e = exposure.get(p.id)
    if (v === null || !e || e.listingDays <= 0) continue
    const s = stratumOf(p, now)
    const st = strata.get(s) ?? { with: emptyCell(), without: emptyCell() }
    strata.set(s, st)
    for (const cell of [v ? st.with : st.without, v ? all.with : all.without]) {
      cell.products.add(p.id)
      cell.suppliers.add(p.supplierId)
      cell.orders += e.paidOrders
      cell.units += e.units
      cell.closed += e.closedOrders
      cell.days += e.listingDays
    }
  }
  let num = 0
  let den = 0
  let varNum = 0
  let informative = 0
  for (const st of strata.values()) {
    const a = st.with.orders
    const b = st.without.orders
    const t1 = st.with.days
    const t0 = st.without.days
    const t = t1 + t0
    if (t1 <= 0 || t0 <= 0 || a + b === 0) continue
    informative++
    num += (a * t0) / t
    den += (b * t1) / t
    varNum += (t1 * t0 * (a + b)) / (t * t)
  }
  const rate = (o: number, d: number) => (d > 0 ? (100 * o) / d : null)
  const crudeW = rate(all.with.orders, all.with.days)
  const crudeWo = rate(all.without.orders, all.without.days)
  let adjusted: number | null = null
  let lo: number | null = null
  let hi: number | null = null
  if (num > 0 && den > 0) {
    adjusted = num / den
    const se = Math.sqrt(varNum / (num * den))
    lo = Math.exp(Math.log(adjusted) - z * se)
    hi = Math.exp(Math.log(adjusted) + z * se)
  }
  const reasons: string[] = []
  if (all.with.products.size < QUALITY_MIN_PRODUCTS_EACH_SIDE || all.without.products.size < QUALITY_MIN_PRODUCTS_EACH_SIDE) reasons.push("too_few_products")
  if (all.with.suppliers.size < QUALITY_MIN_SUPPLIERS_EACH_SIDE || all.without.suppliers.size < QUALITY_MIN_SUPPLIERS_EACH_SIDE) reasons.push("too_few_suppliers")
  if (all.with.orders + all.without.orders < QUALITY_MIN_ORDERS) reasons.push("too_few_orders")
  if (informative < QUALITY_MIN_STRATA) reasons.push("too_few_comparable_strata")
  if (adjusted === null) reasons.push("ratio_not_computable")
  let verdict: FeatureVerdict
  if (reasons.length > 0) verdict = "insufficient"
  else if (lo! > 1) verdict = "positive"
  else if (hi! < 1) verdict = "negative"
  else {
    verdict = "unclear"
    reasons.push("interval_includes_1")
  }
  const share = (c: number, o: number) => (o > 0 ? c / o : null)
  return {
    feature,
    measured: {
      productsWith: all.with.products.size,
      productsWithout: all.without.products.size,
      suppliersWith: all.with.suppliers.size,
      suppliersWithout: all.without.suppliers.size,
      ordersWith: all.with.orders,
      ordersWithout: all.without.orders,
      unitsWith: all.with.units,
      unitsWithout: all.without.units,
      closedWith: all.with.closed,
      closedWithout: all.without.closed,
      informativeStrata: informative,
    },
    estimated: {
      listingDaysWith: Math.round(all.with.days),
      listingDaysWithout: Math.round(all.without.days),
      crudeRateWith: crudeW,
      crudeRateWithout: crudeWo,
      crudeRatio: crudeW != null && crudeWo != null && crudeWo > 0 ? crudeW / crudeWo : null,
      adjustedRatio: adjusted,
      lo,
      hi,
      closedShareWith: share(all.with.closed, all.with.orders),
      closedShareWithout: share(all.without.closed, all.without.orders),
    },
    verdict,
    reasons,
  }
}

/** What can not be measured or concluded — written in every report, never hidden. */
export const QUALITY_LIMITS = [
  "no_causality",
  "views_not_measured",
  "cart_history_not_recorded",
  "traffic_and_visibility_not_measured",
  "stock_history_unknown",
  "listing_history_estimated",
  "reseller_price_not_adjusted",
  "careful_supplier_confounding",
  "returns_by_reason_not_included",
] as const

export type QualityEffectReport = {
  windowDays: number
  generatedAt: string
  productsRead: number
  productsWithExposure: number
  truncated: boolean
  bonferroniZ: number
  effects: FeatureEffect[]
  limits: readonly string[]
}

export function buildQualityEffectReport(args: {
  products: ReadonlyArray<QualityProduct>
  exposure: ReadonlyMap<string, QualityExposure>
  now: Date
  truncated: boolean
}): QualityEffectReport {
  const z = bonferroniZ(QUALITY_FEATURES.length)
  const effects = args.truncated
    ? [] // a capped read compares a biased sample: no figure at all
    : QUALITY_FEATURES.map((f) => measureFeature(f, args.products, args.exposure, args.now, z))
  return {
    windowDays: QUALITY_WINDOW_DAYS,
    generatedAt: args.now.toISOString(),
    productsRead: args.products.length,
    productsWithExposure: args.products.filter((p) => (args.exposure.get(p.id)?.listingDays ?? 0) > 0).length,
    truncated: args.truncated,
    bonferroniZ: z,
    effects,
    limits: QUALITY_LIMITS,
  }
}

/** Listing-days of one listing inside the window (from its creation or the window start, to now). */
export function listingDaysInWindow(listingCreatedAt: Date, now: Date, windowDays = QUALITY_WINDOW_DAYS): number {
  const start = Math.max(listingCreatedAt.getTime(), now.getTime() - windowDays * DAY)
  return Math.max(0, (now.getTime() - start) / DAY)
}

// ── For the supplier: its OWN sheets, with the marketplace's aggregate evidence ─────────────────────────────────────

export type QualityRecommendation = {
  productId: string
  productName: string
  feature: QualityFeature
  /** Marketplace-wide adjusted ratio and interval (aggregate of ≥ 5 suppliers on each side — never one supplier's data). */
  adjustedRatio: number
  lo: number
  /** The product's own observed distribution (counts of its OWN listings and orders). */
  resellersListing: number
  paidOrders90d: number
  priority: number
}

/**
 * Only elements with a `positive` verdict are recommended; ranked by the LOWER bound of the association (never the
 * point estimate) × the product's own distribution — what most plausibly has commercial value. Nothing is applied.
 */
export function supplierQualityRecommendations(args: {
  ownProducts: ReadonlyArray<QualityProduct & { name: string }>
  ownExposure: ReadonlyMap<string, QualityExposure & { resellersListing: number }>
  report: QualityEffectReport
  max?: number
}): QualityRecommendation[] {
  const positive = args.report.effects.filter((e) => e.verdict === "positive" && e.estimated.lo != null && e.estimated.adjustedRatio != null)
  const out: QualityRecommendation[] = []
  for (const p of args.ownProducts) {
    const ex = args.ownExposure.get(p.id)
    for (const e of positive) {
      if (featureValue(e.feature, p) !== false) continue
      // « 5+ photos » already implies « 3+ »: recommend the step the product actually needs.
      if (e.feature === "photos_5plus" && p.imageCount < 3 && positive.some((x) => x.feature === "photos_3plus")) continue
      const resellers = ex?.resellersListing ?? 0
      out.push({
        productId: p.id,
        productName: p.name.slice(0, 120),
        feature: e.feature,
        adjustedRatio: e.estimated.adjustedRatio!,
        lo: e.estimated.lo!,
        resellersListing: resellers,
        paidOrders90d: ex?.paidOrders ?? 0,
        priority: (e.estimated.lo! - 1) * (1 + resellers + (ex?.paidOrders ?? 0)),
      })
    }
  }
  return out.sort((a, b) => b.priority - a.priority).slice(0, args.max ?? 10)
}

/**
 * The marketplace associations a supplier may be shown: POSITIVE verdicts only (whole interval above 1), as
 * `{ feature, adjustedRatio, lo }`. ONE filter for the listing-quality API, the readiness panel and the catalogue health.
 */
export function positiveQualityEvidence(report: Pick<QualityEffectReport, "effects">): Array<{ feature: QualityFeature; adjustedRatio: number; lo: number }> {
  const out: Array<{ feature: QualityFeature; adjustedRatio: number; lo: number }> = []
  for (const e of report.effects) {
    if (e.verdict !== "positive" || typeof e.estimated.adjustedRatio !== "number" || typeof e.estimated.lo !== "number") continue
    out.push({ feature: e.feature, adjustedRatio: e.estimated.adjustedRatio, lo: e.estimated.lo })
  }
  return out
}

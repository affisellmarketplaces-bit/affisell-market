import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * AFFISELL INTELLIGENCE — how demand reacts to price, estimated on Affisell's own natural experiments (pure).
 * Reviewed 2026-11-18 (method below = what the code does, nothing more).
 *
 * WHAT IS ESTIMATED. A reseller changes a listing's price (`ListingPriceHistory`). Over W days before / after the change:
 *   a0, a1 = paid ORDERS of that listing (orders, not units — a buyer taking 3 counts once);
 *   b0, b1 = paid orders of the OTHER resellers' listings of the SAME product (controls), pooled into one count, minus
 *            the listings whose own price (or a variant price) moved in the window and those created during it.
 *   d = ln((a1+½)/(a0+½)) − ln((b1+½)/(b0+½))     log difference-in-differences of orders (+½: counts may be 0;
 *                                                 it pulls small counts towards "no change" — conservative)
 *   e = d / ln(p1/p0)                            elasticity of the LISTING's orders to its OWN price, relative to the
 *                                                 same product's other listings (arc, log scale)
 *   var(d) ≈ Σ 1/(n+½)                           Poisson approximation; real counts are often MORE variable, which is
 *                                                 one reason the pooling below adds a between-event variance.
 *
 * FIXED EFFECTS, in plain words. The before/after difference removes everything constant about the listing (its
 * reseller, its audience, its usual level). The comparison with the same product's other listings removes what changes
 * over those days for the PRODUCT as a whole, provided it changes every listing in the same PROPORTION (the log form):
 * product demand, season, marketplace-wide moves, the product's own stock (shared by its resellers). Nothing removes
 * what changes only for the modified listing: the reseller's own campaign, traffic or coupon, the listing being hidden
 * or deactivated (no history of that), a variant's own stock, or orders a cheaper listing takes FROM its controls
 * (that last one inflates the estimate: a listing reacts more than the product). The measured reaction also includes
 * whatever the price changes besides conversion (e.g. visibility if a listing's rank depends on its price): without
 * visit data the two can not be told apart.
 *
 * TIMING BIAS. Resellers choose when to change a price, often after a bad stretch (regression to the mean then
 * flatters a cut). Tested, not assumed away: where the data reach W more days back, the same difference-in-differences
 * is computed between [t−2W, t−W) and [t−W, t) — a placebo with no price change. A pooled placebo whose interval
 * excludes 0 means the listings were already drifting: the estimate is graded down.
 *
 * POOLING (poolPriceResponse). Random effects (DerSimonian–Laird between-event variance), standard error = the larger of
 * DerSimonian–Laird and Hartung–Knapp, intervals with Student quantiles (small numbers of events), plus:
 *   - the interval of the MEAN (lo, hi) — a category's average reaction; conclusions (elastic / inelastic) rest on it;
 *   - the interval for ONE product (predLo, predHi), wider: it includes the spread between products. A simulation of a
 *     single product must use this one — a category average is not a measurement of that product.
 * Events of the same product share controls, so influence is checked by leaving out one PRODUCT at a time.
 *
 * HOW MUCH TO TRUST IT (grade). Five events allow a first number, never trust. The grade follows the weakest property:
 * products and resellers involved, influence of a single product, placebo, heterogeneity, stability between the two
 * halves of the period, and an out-of-sample check (each event predicted only from events already finished). Only
 * « modérée » or « solide » may change a simulated volume; « faible » is shown with its reasons, nothing is adjusted.
 *
 * Nothing here is a causal proof, and nothing changes a price.
 */
export const PR_WINDOW_DAYS = 14
/** Smaller relative moves are rounding, not an experiment. */
export const PR_MIN_CHANGE = 0.03
/** Orders of the listing (before + after) for an event to carry information. */
export const PR_MIN_LISTING_ORDERS = 3
/** Orders of the control listings (before + after) — without a comparison the event says nothing about price. */
export const PR_MIN_CONTROL_ORDERS = 3
/** Usable events before a pool is reported at all. */
export const PR_MIN_EVENTS = 5

const DAY_MS = 86_400_000

export type PriceChange = {
  listingId: string
  productId: string
  at: Date
  fromCents: number
  toCents: number
  /** Reseller who owns the listing (independence check: several resellers, not one reseller's habits). */
  resellerId?: string
  /** Writer declared in `ListingPriceHistory.source` (reseller_ui, auto_adjust, margin_auto_fix, …). */
  source?: string
}
export type ListingOrder = { listingId: string; productId: string; paidAt: Date }

export type ExclusionReason = "small_change" | "window_incomplete" | "overlapping_change" | "too_few_listing_orders" | "no_control" | "listing_too_new"

export type PriceEvent = {
  listingId: string
  productId: string
  resellerId?: string
  source?: string
  at: Date
  fromCents: number
  toCents: number
  /** ln(p1 / p0) */
  x: number
  a0: number
  a1: number
  b0: number
  b1: number
  d: number
  varD: number
  elasticity: number
  varE: number
  /** Placebo [t−2W, t−W) → [t−W, t): same estimator with no price change. Absent when the data do not reach back. */
  pre?: { d: number; varD: number }
}

export function measurePriceEvents(
  changes: PriceChange[],
  orders: ListingOrder[],
  ctx: {
    now: Date
    dataFrom: Date
    /** Listing creation dates: a listing created inside the window has no full "before" (treated) or inflates the
     * controls' "after" (control). Unknown listings are assumed old enough. */
    listingCreatedAt?: Map<string, Date>
    /** Other price movements of a listing that are not experiments themselves (variant prices): they still disqualify
     * the listing as a control and overlap a change of the same listing. */
    otherChanges?: Array<{ listingId: string; at: Date }>
  }
): { events: PriceEvent[]; excluded: Record<ExclusionReason, number>; observed: number } {
  const W = PR_WINDOW_DAYS * DAY_MS
  const excluded: Record<ExclusionReason, number> = { small_change: 0, window_incomplete: 0, overlapping_change: 0, too_few_listing_orders: 0, no_control: 0, listing_too_new: 0 }
  const changesByListing = new Map<string, Date[]>()
  for (const c of [...changes, ...(ctx.otherChanges ?? [])]) changesByListing.set(c.listingId, [...(changesByListing.get(c.listingId) ?? []), c.at])
  const ordersByProduct = new Map<string, ListingOrder[]>()
  for (const o of orders) ordersByProduct.set(o.productId, [...(ordersByProduct.get(o.productId) ?? []), o])
  const changedWithin = (listingId: string, from: number, to: number, except?: Date) =>
    (changesByListing.get(listingId) ?? []).some((t) => t !== except && t.getTime() >= from && t.getTime() <= to)
  const createdAfter = (listingId: string, time: number) => (ctx.listingCreatedAt?.get(listingId)?.getTime() ?? -Infinity) > time

  const events: PriceEvent[] = []
  for (const c of changes) {
    if (c.fromCents <= 0 || c.toCents <= 0 || Math.abs(c.toCents - c.fromCents) / c.fromCents < PR_MIN_CHANGE) {
      excluded.small_change++
      continue
    }
    const t = c.at.getTime()
    if (t - W < ctx.dataFrom.getTime() || t + W > ctx.now.getTime()) {
      excluded.window_incomplete++
      continue
    }
    if (createdAfter(c.listingId, t - W)) {
      excluded.listing_too_new++
      continue
    }
    // A second change of the same listing inside the windows mixes two experiments.
    if (changedWithin(c.listingId, t - W, t + W, c.at)) {
      excluded.overlapping_change++
      continue
    }
    // The placebo needs W more days of data, no change of the listing then, and controls still clean then.
    const withPre = t - 2 * W >= ctx.dataFrom.getTime() && !changedWithin(c.listingId, t - 2 * W, t - W) && !createdAfter(c.listingId, t - 2 * W)
    let a0 = 0, a1 = 0, b0 = 0, b1 = 0, ap = 0, bp = 0, b0p = 0
    const controlOk = new Map<string, boolean>()
    const controlPreOk = new Map<string, boolean>()
    for (const o of ordersByProduct.get(c.productId) ?? []) {
      const ot = o.paidAt.getTime()
      if (ot < t - (withPre ? 2 * W : W) || ot >= t + W) continue
      const own = o.listingId === c.listingId
      if (ot < t - W) {
        // Placebo's earliest window only.
        if (own) ap++
        else {
          let ok = controlPreOk.get(o.listingId)
          if (ok === undefined) controlPreOk.set(o.listingId, (ok = !changedWithin(o.listingId, t - 2 * W, t + W) && !createdAfter(o.listingId, t - 2 * W)))
          if (ok) bp++
        }
        continue
      }
      const after = ot >= t
      if (own) {
        if (after) a1++
        else a0++
        continue
      }
      // A control listing whose own price moved in the window, or created during it, is not a control.
      let ok = controlOk.get(o.listingId)
      if (ok === undefined) controlOk.set(o.listingId, (ok = !changedWithin(o.listingId, t - W, t + W) && !createdAfter(o.listingId, t - W)))
      if (!ok) continue
      if (after) b1++
      else b0++
      if (!after && withPre) {
        let pok = controlPreOk.get(o.listingId)
        if (pok === undefined) controlPreOk.set(o.listingId, (pok = !changedWithin(o.listingId, t - 2 * W, t + W) && !createdAfter(o.listingId, t - 2 * W)))
        if (pok) b0p++
      }
    }
    if (a0 + a1 < PR_MIN_LISTING_ORDERS) {
      excluded.too_few_listing_orders++
      continue
    }
    if (b0 + b1 < PR_MIN_CONTROL_ORDERS) {
      excluded.no_control++
      continue
    }
    const lr = (after: number, before: number) => Math.log((after + 0.5) / (before + 0.5))
    const x = Math.log(c.toCents / c.fromCents)
    const d = lr(a1, a0) - lr(b1, b0)
    const varD = 1 / (a1 + 0.5) + 1 / (a0 + 0.5) + 1 / (b1 + 0.5) + 1 / (b0 + 0.5)
    const pre =
      withPre && ap + a0 >= PR_MIN_LISTING_ORDERS && bp + b0p >= PR_MIN_CONTROL_ORDERS
        ? { d: lr(a0, ap) - lr(b0p, bp), varD: 1 / (a0 + 0.5) + 1 / (ap + 0.5) + 1 / (b0p + 0.5) + 1 / (bp + 0.5) }
        : undefined
    events.push({
      listingId: c.listingId,
      productId: c.productId,
      ...(c.resellerId ? { resellerId: c.resellerId } : {}),
      ...(c.source ? { source: c.source } : {}),
      at: c.at,
      fromCents: c.fromCents,
      toCents: c.toCents,
      x,
      a0,
      a1,
      b0,
      b1,
      d,
      varD,
      elasticity: d / x,
      varE: varD / (x * x),
      ...(pre ? { pre } : {}),
    })
  }
  return { events, excluded, observed: changes.length }
}

// ── Pooling: random effects, honest small-sample intervals ─────────────────────────────────────────────────────────

/** Two-sided 95 % Student quantile (exact table to 30 degrees of freedom, then a close approximation). */
export function t975(df: number): number {
  const T = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042]
  if (df < 1) return Infinity
  return df <= 30 ? T[Math.floor(df) - 1]! : 1.96 + 2.5 / df
}

export type MetaResult = {
  k: number
  /** Random-effects mean (DerSimonian–Laird between-event variance). */
  mean: number
  /** Its standard error: the larger of DerSimonian–Laird and Hartung–Knapp (never narrower than either). */
  se: number
  /** Between-event variance of the true effects (0 = the events agree beyond chance). */
  tau2: number
  /** Share of the spread that is real heterogeneity rather than chance (0–1). */
  i2: number
  /** 95 % interval of the MEAN effect (Student, k − 1 degrees of freedom). */
  lo: number
  hi: number
  /** 95 % interval for ONE NEW product (Student, k − 2 d.f., includes the between-event spread) — what a simulation of a
   * single product must use. null below 3 events. */
  predLo: number | null
  predHi: number | null
  /** Fixed-effect mean, kept for comparison only. */
  fixedMean: number
  fixedSe: number
  /** Weight of each item in the random-effects mean (same order as the input). */
  weights: number[]
}

/** Random-effects meta-analysis of independent estimates y with variances v. Null below 2 items. */
export function metaAnalyse(items: Array<{ y: number; v: number }>): MetaResult | null {
  const k = items.length
  if (k < 2) return null
  const w = items.map((i) => 1 / i.v)
  const sw = w.reduce((a, b) => a + b, 0)
  const fixedMean = items.reduce((a, i, j) => a + w[j]! * i.y, 0) / sw
  const q = items.reduce((a, i, j) => a + w[j]! * (i.y - fixedMean) ** 2, 0)
  const c = sw - w.reduce((a, b) => a + b * b, 0) / sw
  const tau2 = c > 0 ? Math.max(0, (q - (k - 1)) / c) : 0
  const ws = items.map((i) => 1 / (i.v + tau2))
  const sws = ws.reduce((a, b) => a + b, 0)
  const mean = items.reduce((a, i, j) => a + ws[j]! * i.y, 0) / sws
  const seDl = Math.sqrt(1 / sws)
  const seHk = Math.sqrt(items.reduce((a, i, j) => a + ws[j]! * (i.y - mean) ** 2, 0) / ((k - 1) * sws))
  const se = Math.max(seDl, seHk)
  const t = t975(k - 1)
  const tp = k >= 3 ? t975(k - 2) : Infinity
  const spread = Math.sqrt(tau2 + se * se)
  return {
    k,
    mean,
    se,
    tau2,
    i2: q > 0 ? Math.max(0, (q - (k - 1)) / q) : 0,
    lo: mean - t * se,
    hi: mean + t * se,
    predLo: k >= 3 ? mean - tp * spread : null,
    predHi: k >= 3 ? mean + tp * spread : null,
    fixedMean,
    fixedSe: Math.sqrt(1 / sw),
    weights: ws.map((x) => x / sws),
  }
}

const elasticityItems = (events: PriceEvent[]) => events.map((e) => ({ y: e.elasticity, v: e.varE }))

// ── Validation: does the estimate predict what happens NEXT better than "no price effect"? ─────────────────────────

export type PredictionItem = { d: number; x: number; varD: number; mean: number; se: number; tau2: number }
export type PredictionScore = {
  n: number
  /** Mean absolute error on the log-change of orders vs controls: model (e × Δ ln price) and constant volume (0). */
  maeModel: number
  maeConstant: number
  /** Paired z of (|error constant| − |error model|): ≥ 2 = the model predicts clearly better. */
  z: number | null
  /** Share of outcomes inside the 95 % prediction band (≈ 95 % if the stated uncertainty is honest). */
  coverage: number
  verdict: "meilleur" | "moins_bon" | "non_tranche" | "trop_peu"
}

export const PR_MIN_PREDICTIONS = 10

export function scorePredictions(items: PredictionItem[]): PredictionScore {
  const n = items.length
  if (n === 0) return { n: 0, maeModel: 0, maeConstant: 0, z: null, coverage: 0, verdict: "trop_peu" }
  const errM = items.map((i) => Math.abs(i.d - i.mean * i.x))
  const errC = items.map((i) => Math.abs(i.d))
  const delta = items.map((_, j) => errC[j]! - errM[j]!)
  const md = delta.reduce((a, b) => a + b, 0) / n
  const sd = n > 1 ? Math.sqrt(delta.reduce((a, b) => a + (b - md) ** 2, 0) / (n - 1)) : 0
  const z = n > 1 && sd > 0 ? md / (sd / Math.sqrt(n)) : null
  const covered = items.filter((i) => Math.abs(i.d - i.mean * i.x) <= 1.96 * Math.sqrt(i.varD + i.x * i.x * (i.se * i.se + i.tau2))).length
  const verdict = n < PR_MIN_PREDICTIONS || z === null ? "trop_peu" : z >= 2 ? "meilleur" : z <= -2 ? "moins_bon" : "non_tranche"
  return { n, maeModel: errM.reduce((a, b) => a + b, 0) / n, maeConstant: errC.reduce((a, b) => a + b, 0) / n, z, coverage: covered / n, verdict }
}

/** Out-of-sample check inside the data: each event is predicted ONLY from events whose whole window had ended before
 * its change (what Affisell could have known at that date) — no look-ahead. */
export function backtestEvents(events: PriceEvent[]): PredictionScore {
  const W = PR_WINDOW_DAYS * DAY_MS
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime())
  const items: PredictionItem[] = []
  for (const e of sorted) {
    const known = sorted.filter((p) => p.at.getTime() + W <= e.at.getTime())
    if (known.length < PR_MIN_EVENTS || new Set(known.map((p) => p.productId)).size < PR_MIN_PRODUCTS) continue
    const m = metaAnalyse(elasticityItems(known))
    if (m) items.push({ d: e.d, x: e.x, varD: e.varD, mean: m.mean, se: m.se, tau2: m.tau2 })
  }
  return scorePredictions(items)
}

/** A past estimate, as recorded by the daily run (AuditLog `intelligence.price_response_estimate`). */
export type RecordedEstimate = { poolKey: string; recordedAt: Date; mean: number; se: number; tau2: number }

/** Forward check against the RECORDED history: each event is scored with the latest estimate recorded for its pool
 * BEFORE its price changed. */
export function scoreRecordedEstimates(poolKey: string, events: PriceEvent[], records: RecordedEstimate[]): PredictionScore {
  const mine = records.filter((r) => r.poolKey === poolKey).sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
  const items: PredictionItem[] = []
  for (const e of events) {
    const before = mine.filter((r) => r.recordedAt.getTime() <= e.at.getTime())
    const r = before[before.length - 1]
    if (r) items.push({ d: e.d, x: e.x, varD: e.varD, mean: r.mean, se: r.se, tau2: r.tau2 })
  }
  return scorePredictions(items)
}

// ── Assessment of one pool: estimate + how much to trust it ────────────────────────────────────────────────────────

/** Distinct products before a pool is used at all (events of one product share their controls: not independent). */
export const PR_MIN_PRODUCTS = 3

export type ReliabilityGrade = "insuffisante" | "faible" | "moderee" | "solide"

export type PooledResponse = {
  n: number
  cuts: number
  raises: number
  products: number
  /** Distinct resellers who made the changes; null when the changes carry no reseller id. */
  resellers: number | null
  /** Random-effects mean elasticity and its standard error (see MetaResult). */
  elasticity: number
  se: number
  tau2: number
  i2: number
  /** 95 % interval of the mean (category / marketplace average). */
  lo: number
  hi: number
  /** 95 % interval for one product taken alone (null below 3 events). */
  predLo: number | null
  predHi: number | null
  /** "elastic" / "inelastic" only when the whole interval of the mean is on one side; "undetermined" otherwise. */
  verdict: "elastic" | "inelastic" | "undetermined"
  medianChangePct: number
  maxAbsChangePct: number
  firstAt: string
  lastAt: string
  /** Leaving out one PRODUCT at a time: range of the estimate, and whether one product decides the conclusion. */
  influence: { min: number; max: number; fragile: boolean; maxProductWeight: number }
  /** Placebo on the 14 days BEFORE the pre-window: did the listing already drift away from its controls before the
   * change (timing bias)? null when fewer than PR_MIN_EVENTS events have that earlier window. */
  preTrend: { n: number; meanLogChange: number; lo: number; hi: number; flagged: boolean } | null
  /** Earlier half vs later half of the events (by date). null when a half has < PR_MIN_EVENTS events. */
  stability: { early: number; late: number; z: number; unstable: boolean } | null
  backtest: PredictionScore
  /** Price changes per declared writer (reseller_ui, auto_adjust, …): automated changes are less exposed to timing bias. */
  sources: Record<string, number>
  grade: ReliabilityGrade
  gradeReasons: string[]
}

const verdictOf = (lo: number, hi: number): PooledResponse["verdict"] => (hi < -1 ? "elastic" : lo > -1 && hi < 0 ? "inelastic" : "undetermined")

export function poolPriceResponse(events: PriceEvent[]): PooledResponse | null {
  if (events.length < PR_MIN_EVENTS) return null
  const m = metaAnalyse(elasticityItems(events))!
  const verdict = verdictOf(m.lo, m.hi)
  const productIds = [...new Set(events.map((e) => e.productId))]
  const resellerIds = events.every((e) => e.resellerId) ? new Set(events.map((e) => e.resellerId!)).size : null

  // Influence, by product (a product's events share their controls).
  let min = m.mean, max = m.mean, fragile = false, maxProductWeight = 0
  for (const pid of productIds) {
    maxProductWeight = Math.max(maxProductWeight, events.reduce((a, e, j) => a + (e.productId === pid ? m.weights[j]! : 0), 0))
    const rest = events.filter((e) => e.productId !== pid)
    const r = rest.length >= 2 ? metaAnalyse(elasticityItems(rest)) : null
    if (!r) {
      fragile = true
      continue
    }
    min = Math.min(min, r.mean)
    max = Math.max(max, r.mean)
    if (verdictOf(r.lo, r.hi) !== verdict || (r.hi < 0) !== (m.hi < 0)) fragile = true
  }

  const pre = events.filter((e) => e.pre)
  const pm = pre.length >= PR_MIN_EVENTS ? metaAnalyse(pre.map((e) => ({ y: e.pre!.d, v: e.pre!.varD }))) : null
  const preTrend = pm ? { n: pre.length, meanLogChange: pm.mean, lo: pm.lo, hi: pm.hi, flagged: pm.lo > 0 || pm.hi < 0 } : null

  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime())
  const half = Math.floor(sorted.length / 2)
  const e1 = half >= PR_MIN_EVENTS ? metaAnalyse(elasticityItems(sorted.slice(0, half))) : null
  const e2 = sorted.length - half >= PR_MIN_EVENTS && e1 ? metaAnalyse(elasticityItems(sorted.slice(half))) : null
  const stability = e1 && e2 ? (() => {
    const z = (e1.mean - e2.mean) / Math.sqrt(e1.se ** 2 + e2.se ** 2)
    return { early: e1.mean, late: e2.mean, z, unstable: Math.abs(z) > 2 }
  })() : null

  const backtest = backtestEvents(events)
  const sources: Record<string, number> = {}
  for (const e of events) sources[e.source ?? "inconnue"] = (sources[e.source ?? "inconnue"] ?? 0) + 1

  // Grade: the WEAKEST property decides. Each reason is written as it will be shown.
  const blocking: string[] = []
  const weak: string[] = []
  if (productIds.length < PR_MIN_PRODUCTS) blocking.push(`${productIds.length} produit(s) distinct(s) seulement (minimum ${PR_MIN_PRODUCTS})`)
  if (resellerIds !== null && resellerIds < 2) blocking.push("un seul revendeur à l'origine des changements")
  if (events.length < 15) weak.push(`${events.length} changements de prix seulement`)
  if (productIds.length < 5) weak.push(`${productIds.length} produits distincts seulement`)
  if (resellerIds === null) weak.push("revendeurs à l'origine des changements inconnus")
  if (fragile) weak.push("la conclusion dépend d'un seul produit")
  if (!preTrend) weak.push("biais de moment non testable (trop peu d'historique avant les changements)")
  else if (preTrend.flagged) weak.push("les ventes de l'annonce s'écartaient déjà de celles des autres revendeurs avant le changement (biais de moment probable)")
  if (m.i2 > 0.75) weak.push(`réactions très différentes d'un changement à l'autre (hétérogénéité ${Math.round(m.i2 * 100)} %)`)
  if (stability?.unstable) weak.push("estimation différente entre la première et la seconde moitié de la période")
  // Adjusting a volume is only worth it once the estimate has predicted later changes better than "no price effect".
  if (backtest.verdict === "trop_peu") weak.push(`validation hors échantillon pas encore possible (${backtest.n} prévision(s) vérifiable(s), minimum ${PR_MIN_PREDICTIONS})`)
  else if (backtest.verdict !== "meilleur") weak.push(`hors échantillon, ne prédit pas clairement mieux que le volume constant (${backtest.n} prévisions)`)
  const solid =
    events.length >= 40 && productIds.length >= 15 && (resellerIds ?? 0) >= 10 && !!preTrend && preTrend.n >= 15 && !preTrend.flagged &&
    !fragile && m.i2 <= 0.5 && !!stability && !stability.unstable && backtest.verdict === "meilleur"
  const grade: ReliabilityGrade = blocking.length > 0 ? "insuffisante" : weak.length > 0 ? "faible" : solid ? "solide" : "moderee"
  const gradeReasons = blocking.length > 0 ? blocking : weak.length > 0 ? weak : solid ? [] : ["volume encore insuffisant pour « solide » (40 changements, 15 produits, 10 revendeurs, 15 placebos)"]

  const changes = events.map((e) => (e.toCents / e.fromCents - 1) * 100).sort((a, b) => a - b)
  const mid = Math.floor(changes.length / 2)
  const times = events.map((e) => e.at.getTime())
  return {
    n: events.length,
    cuts: events.filter((e) => e.x < 0).length,
    raises: events.filter((e) => e.x > 0).length,
    products: productIds.length,
    resellers: resellerIds,
    elasticity: m.mean,
    se: m.se,
    tau2: m.tau2,
    i2: m.i2,
    lo: m.lo,
    hi: m.hi,
    predLo: m.predLo,
    predHi: m.predHi,
    verdict,
    medianChangePct: changes.length % 2 ? changes[mid]! : (changes[mid - 1]! + changes[mid]!) / 2,
    maxAbsChangePct: Math.max(...changes.map(Math.abs)),
    firstAt: new Date(Math.min(...times)).toISOString(),
    lastAt: new Date(Math.max(...times)).toISOString(),
    influence: { min, max, fragile, maxProductWeight },
    preTrend,
    stability,
    backtest,
    sources,
    grade,
    gradeReasons,
  }
}

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)} %`
const num = (v: number) => v.toFixed(2).replace(".", ",").replace("-", "−")

/** Effect of a 10 % price cut implied by an elasticity: on orders, and on revenue (price × orders). */
export function impliedTenPercentCut(e: number): { ordersPct: number; revenuePct: number } {
  return { ordersPct: (Math.pow(0.9, e) - 1) * 100, revenuePct: (Math.pow(0.9, 1 + e) - 1) * 100 }
}

export type PricePool = { key: string; label: string; events: PriceEvent[] }

export function backtestLabel(b: PredictionScore): string {
  if (b.verdict === "trop_peu") return `trop peu de prévisions vérifiables (${b.n}, minimum ${PR_MIN_PREDICTIONS})`
  const word = b.verdict === "meilleur" ? "prédit mieux" : b.verdict === "moins_bon" ? "prédit moins bien" : "ne prédit pas clairement mieux"
  return `${word} que le volume constant sur ${b.n} changements suivants (erreur moyenne ${b.maeModel.toFixed(2)} contre ${b.maeConstant.toFixed(2)}, ${Math.round(b.coverage * 100)} % dans l’intervalle annoncé)`
}

export const GRADE_LABELS: Record<ReliabilityGrade, string> = { insuffisante: "insuffisante", faible: "faible", moderee: "modérée", solide: "solide" }

/** What the comparison removes and what it does not — the exact properties of the estimator, shown on every signal. */
export const PRICE_RESPONSE_SCOPE =
  "Neutralisé : ce qui touche dans la même proportion toutes les annonces du même produit les mêmes jours (demande pour le produit, saison, mouvements de la marketplace, stock du produit). Non neutralisé : ce qui ne touche que l’annonce modifiée (campagne, trafic ou coupon du revendeur, annonce masquée, stock d’une variante), le moment choisi pour changer le prix (testé par un placebo quand l’historique le permet), et les ventes prises aux autres revendeurs — une annonce réagit donc plus que le produit entier. Sans données de visites, on ne distingue pas un effet sur la conversion d’un effet sur la visibilité. Estimation statistique, pas une preuve causale."

export function priceResponseSignals(
  pools: PricePool[],
  coverage: { observed: number; usable: number; excluded: Partial<Record<ExclusionReason, number>> },
  ctx: { observedAt: string; window: { from: string; to: string } }
): StrategicSignal[] {
  const out: StrategicSignal[] = []
  for (const pool of pools) {
    const r = poolPriceResponse(pool.events)
    if (!r || r.verdict === "undetermined" || r.grade === "insuffisante") continue
    const cut = impliedTenPercentCut(r.elasticity)
    const elastic = r.verdict === "elastic"
    const trusted = r.grade === "moderee" || r.grade === "solide"
    out.push({
      id: `commercial:price_response:${pool.key}`,
      domain: "commercial",
      priority: trusted ? "important" : "study",
      kind: "estimate",
      title: elastic
        ? `${pool.label} : la demande a réagi fortement au prix — en moyenne, une baisse de 10 % correspond à environ ${pct(cut.ordersPct)} de commandes (chiffre d’affaires ${pct(cut.revenuePct)}) — fiabilité ${GRADE_LABELS[r.grade]}`
        : `${pool.label} : la demande a réagi peu au prix — en moyenne, une baisse de 10 % ne correspond qu’à environ ${pct(cut.ordersPct)} de commandes (chiffre d’affaires ${pct(cut.revenuePct)}) — fiabilité ${GRADE_LABELS[r.grade]}`,
      evidence: [
        { label: "Changements de prix exploitables", value: `${r.n} (${r.cuts} baisses, ${r.raises} hausses) sur ${r.products} produits${r.resellers !== null ? `, ${r.resellers} revendeurs` : ""}, du ${r.firstAt.slice(0, 10)} au ${r.lastAt.slice(0, 10)}` },
        { label: "Élasticité moyenne (intervalle 95 %, effets aléatoires)", value: `${num(r.elasticity)} (de ${num(r.lo)} à ${num(r.hi)})` },
        ...(r.predLo !== null && r.predHi !== null ? [{ label: "Pour un produit pris isolément (intervalle 95 %)", value: `de ${num(r.predLo)} à ${num(r.predHi)}` }] : []),
        { label: "Hétérogénéité entre changements", value: `${Math.round(r.i2 * 100)} %` },
        { label: "Test du biais de moment (placebo avant le changement)", value: r.preTrend ? `${r.preTrend.flagged ? "écart déjà présent avant le changement" : "aucun écart détecté"} (${r.preTrend.n} changements testés)` : "non testable (historique trop court)" },
        { label: "Validation hors échantillon", value: backtestLabel(r.backtest) },
        { label: "Fiabilité", value: `${GRADE_LABELS[r.grade]}${r.gradeReasons.length ? ` — ${r.gradeReasons.join(" ; ")}` : ""}` },
        { label: "Méthode", value: `Commandes payées ${PR_WINDOW_DAYS} j avant / après, comparées aux autres revendeurs du même produit sans changement de prix` },
      ],
      source: { id: "affisell.listing_price_history", query: `ListingPriceHistory (prix revendeur, |Δ| ≥ ${PR_MIN_CHANGE * 100} %) × Order payées par annonce, ±${PR_WINDOW_DAYS} j` },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: trusted ? "medium" : "low",
      confidenceReason: `Fiabilité ${GRADE_LABELS[r.grade]}${r.gradeReasons.length ? ` (${r.gradeReasons.join(" ; ")})` : ""}. ${PRICE_RESPONSE_SCOPE}`,
      recommendedAction: !trusted
        ? "Ne rien décider sur cette base : observer seulement, la mesure n’est pas encore assez fiable."
        : elastic
          ? "Usage interne : un test de baisse modérée sur quelques annonces peut être envisagé, mesuré sur le chiffre d’affaires et la marge, pas seulement les commandes. Aucune recommandation aux revendeurs, aucune modification automatique."
          : "Usage interne : dans cette catégorie, une baisse de prix a surtout cédé de la marge. Aucune recommandation aux revendeurs, aucune modification automatique.",
      link: null,
    })
  }
  if (coverage.observed > 0 && out.length === 0) {
    const ex = coverage.excluded
    out.push({
      id: "commercial:price_response:coverage",
      domain: "commercial",
      priority: "study",
      kind: "fact",
      title: `Réaction de la demande aux prix : ${coverage.usable} changement(s) de prix exploitable(s) sur ${coverage.observed} observé(s) — pas encore de conclusion`,
      evidence: [
        { label: "Fenêtre incomplète (trop récent ou trop ancien)", value: String(ex.window_incomplete ?? 0) },
        { label: "Trop peu de commandes sur l'annonce", value: String(ex.too_few_listing_orders ?? 0) },
        { label: "Aucun autre revendeur du même produit pour comparer", value: String(ex.no_control ?? 0) },
        { label: "Deux changements rapprochés", value: String(ex.overlapping_change ?? 0) },
        { label: "Variation inférieure à 3 %", value: String(ex.small_change ?? 0) },
        { label: "Annonce créée pendant la fenêtre", value: String(ex.listing_too_new ?? 0) },
      ],
      source: { id: "affisell.listing_price_history", query: "ListingPriceHistory × Order payées par annonce" },
      observedAt: ctx.observedAt,
      window: ctx.window,
      confidence: "high",
      confidenceReason: `Compte exact. Une première estimation demande au moins ${PR_MIN_EVENTS} expériences exploitables sur ${PR_MIN_PRODUCTS} produits distincts ; la fiabilité dépend ensuite de leur qualité (placebo, validation hors échantillon, influence d’un seul produit).`,
      recommendedAction:
        "Rien à décider. Le levier qui fera mûrir cette mesure : plusieurs revendeurs sur les mêmes produits (sans comparaison, une expérience ne dit rien du prix).",
      link: null,
    })
  }
  return out
}

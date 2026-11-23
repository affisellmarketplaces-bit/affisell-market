/**
 * Copilot blind-spot detector (founder brief 2026-11-23, portfolio row 35). PURE, OBSERVATION ONLY — changes no ranking.
 *
 * Question: which sellable products PERFORM where they are listed but the copilot rarely or never puts in its proposals,
 * and which product characteristics does the copilot systematically under-rate?
 *
 * Method (each step said in the report):
 *  1. The copilot's GENERIC order over the WHOLE eligible catalogue (`rankGeneric` — the same `selectionOrder` as the
 *     reseller selection, no shop filter, no personalisation, no cap): « the 12 » are not the boundary of the search.
 *     Reference group = the top `max(12, 10 %)`; « écarté » = ranked below it. When learning snapshots exist, how often
 *     and at which rank the copilot REALLY proposed the product is reported beside (`observed`), never invented.
 *  2. Exposure ≠ traffic: Affisell does not measure shop traffic. The only exposure measured is LISTING-DAYS (days a
 *     product sat in a live reseller listing in the window). Performance = paid, not-closed orders per 100 listing-days,
 *     so a product that sells a lot only because 40 shops list it is NOT an opportunity. Withdrawn listings are not in
 *     the data (a stated limit): only listings live today, and only orders from those shops after the listing date.
 *  3. Product test: Poisson rate ratio vs the reference group (log scale, +0.5 correction), one-sided, Benjamini–Hochberg
 *     over every product tested. Concentration: no reseller may carry > 60 % of the orders.
 *  4. Groups (category, price band, age, competition, readiness, offer completeness, return window, and PAIRS): share in
 *     the top vs share of the eligible catalogue (under-represented ≤ 0.5) × pooled rate test vs the rest, BH over all.
 *  5. Correction loop on SEPARATE data: rules are generated on the OLDER half of the window only, evaluated on the NEWER
 *     half only (no rule is ever judged on the data that discovered it); baseline and corrected rankings both use the
 *     train-window demand (rise off in both), BH over rules, regressions and sample sizes listed, `applied: false`.
 *
 * Never promoted: unsellable (blocked), net per sale under `LOW_NET_CENTS`, quantity ≤ 3, quantity unknown.
 * Confidentiality: no supplier cost or margin (the supplier price only as a band), no buyer data, no reseller identifier;
 * a product is named only when ≥ 3 distinct resellers list it.
 */
import { LOW_NET_CENTS, rankGeneric, selectionOrder, type SelectionCandidate, type SelectionItem } from "@/lib/reseller-copilot/selection"
import { ageBandOf, benjaminiHochberg, competitionBandOf, normalP, priceBandOfCents } from "@/lib/reseller-copilot/learning"
import type { RankCriterion } from "@/lib/reseller-copilot/opportunity"

const DAY = 86_400_000
export const BLIND_SPOT_WINDOW_DAYS = 90
export const BLIND_SPOT_TOP_MIN = 12
export const BLIND_SPOT_TOP_SHARE = 0.1
/** Data floor for one product to be judged (below: « données insuffisantes », never a copilot failure). */
export const BS_MIN_LISTING_DAYS = 300
export const BS_MIN_RESELLERS = 3
export const BS_MIN_ORDERS = 5
export const BS_MAX_CONCENTRATION = 0.6
export const BS_FDR = 0.1
export const BS_UNDER_REPRESENTED = 0.5
export const BS_MIN_GROUP_PRODUCTS = 3
/**
 * A correction rule reserves this share of the reference group for the products carrying its feature (the best of them by
 * the baseline order), replacing the lowest products of the group without it — the same mechanism as the selection's
 * discovery share, so a rule is explainable and bounded.
 */
export const BS_RULE_SHARE = 0.25

export type BlindSpotListing = { affiliateId: string; createdAt: Date }
export type BlindSpotOrder = { affiliateId: string; paidAt: Date; quantity: number; netCents: number; closed: boolean }
export type BlindSpotProductInput = {
  candidate: SelectionCandidate
  /** Listings LIVE today (withdrawn ones are not recorded — stated limit). */
  listings: readonly BlindSpotListing[]
  /** Paid orders of the product in the window, every shop. */
  orders: readonly BlindSpotOrder[]
  /** Real proposals from learning snapshots in the window (null = no learning data). */
  proposals: { shown: number; meanRank: number } | null
}

export type BlindSpotStatus = "opportunite_confirmee" | "signal_prometteur" | "hypothese" | "donnees_insuffisantes" | "non_concluante" | "non_eligible"
export type NotEligibleReason = "bloque" | "gain_faible" | "stock_faible" | "stock_inconnu"

export type Exposure = { listingDays: number; orders: number; units: number; closedOrders: number; netCents: number; resellers: number; sellingResellers: number; maxResellerShare: number; matureShops: number; sellingMatureShops: number }

export type ProductFinding = {
  productId: string
  /** null below `BS_MIN_RESELLERS` listing resellers (never named from fewer shops). */
  name: string | null
  genericRank: number | null
  inTop: boolean
  status: BlindSpotStatus
  notEligible: NotEligibleReason[]
  features: string[]
  exposure: Exposure
  ratePer100: number | null
  rateRatio: { point: number; lo: number; hi: number; p: number; q: number | null } | null
  /** Per sale (mean over not-closed orders): the reseller's real net, `netAffiliateTransferCents`. */
  netPerOrderCents: number | null
  /** Why the copilot places it below the last product of the reference group (its own first criterion). */
  whyBelow: RankCriterion | null
  /** observed = from real proposal snapshots; reproduit = the generic order recomputed today. */
  proposalBasis: "observe" | "reproduit"
  proposals: { shown: number; meanRank: number } | null
  missing: string[]
}

export type GroupFinding = {
  feature: string
  products: number
  catalogueShare: number
  topShare: number
  representation: number
  rate: { inGroup: number; rest: number; ratio: number; lo: number; p: number; q: number }
  status: "angle_mort" | "a_surveiller" | "non_concluant"
}

export type RuleResult = {
  rule: string
  trainEvidence: { ratio: number; p: number; q: number }
  swappedIn: number
  swappedOut: number
  test: { inRatePer100: number; outRatePer100: number; ratio: number; lo: number; hi: number; p: number; q: number; inListingDays: number; outListingDays: number; inNetPerListingDayCents: number; outNetPerListingDayCents: number } | null
  /** Swapped-in products whose test rate is below the swapped-out pooled rate. */
  regressions: number
  verdict: "meilleure" | "moins_bonne" | "non_concluante" | "insuffisante"
  applied: false
}

export type BlindSpotReport = {
  generatedAt: string
  windowDays: number
  eligible: number
  notEligible: number
  topSize: number
  reference: { listingDays: number; orders: number; ratePer100: number | null }
  /** Every product OUTSIDE the reference group (the reference itself is not judged). */
  statusCounts: Record<BlindSpotStatus, number>
  /** Opportunities and promising signals, best evidence first (≤ 30). */
  products: ProductFinding[]
  groups: GroupFinding[]
  /** How the copilot's own first criterion explains the place of the confirmed / promising products. */
  rankingBiases: Partial<Record<RankCriterion, number>>
  simulation: { trainDays: number; testDays: number; rules: RuleResult[]; reason: string | null }
  truncated: boolean
  limits: string[]
}

export const BLIND_SPOT_LIMITS = [
  "exposition = jours de référencement en boutique, pas le trafic (non mesuré par Affisell)",
  "référencements retirés non enregistrés : seuls les référencements actifs aujourd'hui et leurs commandes comptent",
  "le classement générique est recalculé avec la fiche, le prix et le stock d'aujourd'hui",
  "les produits du haut du classement sont plus souvent ajoutés : un biais de position reste possible même par jour de référencement",
  "association observée, jamais une cause démontrée",
] as const

// ---------------------------------------------------------------------------------------------------------------------

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** One-sided Poisson rate-ratio test of a (o1 / e1) vs b (o0 / e0), log scale with +0.5 correction. */
export function rateRatio(o1: number, e1: number, o0: number, e0: number): { point: number; lo: number; hi: number; p: number } | null {
  if (e1 <= 0 || e0 <= 0) return null
  const lr = Math.log((o1 + 0.5) / e1) - Math.log((o0 + 0.5) / e0)
  const se = Math.sqrt(1 / (o1 + 0.5) + 1 / (o0 + 0.5))
  const z = lr / se
  const p = z > 0 ? normalP(z) / 2 : 1 - normalP(z) / 2
  return { point: Math.exp(lr), lo: Math.exp(lr - 1.96 * se), hi: Math.exp(lr + 1.96 * se), p: clamp01(p) }
}

export function notEligibleReasons(item: SelectionItem, c: SelectionCandidate): NotEligibleReason[] {
  const out: NotEligibleReason[] = []
  if (item.readiness === "bloque") out.push("bloque")
  if (item.readiness !== "bloque" && item.net.netCents < LOW_NET_CENTS) out.push("gain_faible")
  if (!c.stockKnown) out.push("stock_inconnu")
  else if (c.stockUnits <= 3) out.push("stock_faible")
  return out
}

/** Discrete characteristics a blind spot may group on — sheet and catalogue facts only, no supplier cost. */
export function productFeatures(c: SelectionCandidate, item: SelectionItem): string[] {
  return [
    `categorie=${c.categoryName ?? c.categoryId ?? "inconnue"}`,
    `prix=${priceBandOfCents(c.basePriceCents)}`,
    `anciennete=${ageBandOf(c.ageDays ?? null)}`,
    `concurrence=${competitionBandOf(c.resellersListing)}`,
    `pret=${item.readiness}`,
    `offre=${c.offerMissingMeasured == null ? "inconnue" : c.offerMissingMeasured.length === 0 ? "complete" : "incomplete"}`,
    `retour=${c.returnWindowDays > 14 ? "etendu" : "legal"}`,
  ]
}

/** Exposure in [from, to): listing-days of live listings + the orders of those shops after their listing date. */
export function exposureOf(p: BlindSpotProductInput, from: Date, to: Date): Exposure {
  const f = from.getTime()
  const t = to.getTime()
  let listingDays = 0
  let matureShops = 0
  const startBy = new Map<string, number>()
  for (const l of p.listings) {
    const start = Math.max(f, l.createdAt.getTime())
    if (start >= t) continue
    listingDays += (t - start) / DAY
    const prev = startBy.get(l.affiliateId)
    startBy.set(l.affiliateId, prev == null ? start : Math.min(prev, start))
    if (t - l.createdAt.getTime() >= 30 * DAY) matureShops++
  }
  let orders = 0
  let units = 0
  let closedOrders = 0
  let netCents = 0
  const by = new Map<string, number>()
  for (const o of p.orders) {
    const ts = o.paidAt.getTime()
    const start = startBy.get(o.affiliateId)
    if (start == null || ts < start || ts >= t) continue
    if (o.closed) {
      closedOrders++
      continue
    }
    orders++
    units += Math.max(1, o.quantity)
    netCents += o.netCents
    by.set(o.affiliateId, (by.get(o.affiliateId) ?? 0) + 1)
  }
  let sellingMatureShops = 0
  for (const l of p.listings) if (t - l.createdAt.getTime() >= 30 * DAY && (by.get(l.affiliateId) ?? 0) > 0) sellingMatureShops++
  const maxShare = orders > 0 ? Math.max(...by.values()) / orders : 0
  return {
    listingDays: Math.round(listingDays * 10) / 10,
    orders,
    units,
    closedOrders,
    netCents,
    resellers: startBy.size,
    sellingResellers: by.size,
    maxResellerShare: Math.round(maxShare * 1000) / 1000,
    matureShops,
    sellingMatureShops,
  }
}

/** Orders of every shop in [from, to) — the demand the copilot itself reads (not exposure-matched). */
function demandIn(p: BlindSpotProductInput, from: Date, to: Date): number {
  let n = 0
  for (const o of p.orders) if (!o.closed && o.paidAt >= from && o.paidAt < to) n++
  return n
}

const topSizeOf = (n: number) => Math.min(n, Math.max(BLIND_SPOT_TOP_MIN, Math.ceil(n * BLIND_SPOT_TOP_SHARE)))

function judgeProduct(e: Exposure, rr: { point: number; lo: number; p: number } | null, q: number | null): BlindSpotStatus {
  if (e.listingDays < BS_MIN_LISTING_DAYS || e.resellers < BS_MIN_RESELLERS || e.orders < BS_MIN_ORDERS || !rr) return "donnees_insuffisantes"
  const concentrated = e.maxResellerShare > BS_MAX_CONCENTRATION
  if (q != null && q <= BS_FDR && rr.lo > 1 && e.sellingResellers >= BS_MIN_RESELLERS && !concentrated) return "opportunite_confirmee"
  if (rr.p < 0.05 && rr.point > 1) return "signal_prometteur"
  if (rr.point > 1) return "hypothese"
  return "non_concluante"
}

function pooled(list: ReadonlyArray<Exposure>): { o: number; e: number; net: number } {
  let o = 0
  let e = 0
  let net = 0
  for (const x of list) {
    o += x.orders
    e += x.listingDays
    net += x.netCents
  }
  return { o, e, net }
}

/** Single features and pairs carried by a product. */
function featureKeys(features: readonly string[]): string[] {
  const out = [...features]
  for (let i = 0; i < features.length; i++) for (let j = i + 1; j < features.length; j++) out.push(`${features[i]} & ${features[j]}`)
  return out
}

/** Group blind spots over a ranked eligible population. */
export function detectGroups(rows: ReadonlyArray<{ features: string[]; inTop: boolean; exposure: Exposure }>, fdr = BS_FDR): GroupFinding[] {
  const n = rows.length
  const top = rows.filter((r) => r.inTop).length
  if (n === 0 || top === 0) return []
  const keysBy = rows.map((r) => new Set(featureKeys(r.features)))
  const all = new Set<string>()
  for (const s of keysBy) for (const k of s) all.add(k)
  const tested: Array<Omit<GroupFinding, "rate" | "status"> & { rr: NonNullable<ReturnType<typeof rateRatio>>; inRate: number; restRate: number }> = []
  for (const k of all) {
    const idx = rows.map((_, i) => i).filter((i) => keysBy[i]!.has(k))
    if (idx.length < BS_MIN_GROUP_PRODUCTS) continue
    const inTop = idx.filter((i) => rows[i]!.inTop).length
    const catalogueShare = idx.length / n
    const topShare = inTop / top
    const representation = topShare / catalogueShare
    if (representation > BS_UNDER_REPRESENTED) continue
    const g = pooled(idx.map((i) => rows[i]!.exposure))
    const restIdx = rows.map((_, i) => i).filter((i) => !keysBy[i]!.has(k))
    const r = pooled(restIdx.map((i) => rows[i]!.exposure))
    if (g.e < BS_MIN_LISTING_DAYS || r.e < BS_MIN_LISTING_DAYS) continue
    const sellers = idx.filter((i) => rows[i]!.exposure.sellingResellers > 0).length
    if (sellers < BS_MIN_GROUP_PRODUCTS) continue
    const rr = rateRatio(g.o, g.e, r.o, r.e)
    if (!rr) continue
    tested.push({ feature: k, products: idx.length, catalogueShare, topShare, representation, rr, inRate: (g.o / g.e) * 100, restRate: (r.o / r.e) * 100 })
  }
  const q = benjaminiHochberg(tested.map((t) => t.rr.p))
  return tested
    .map((t, i): GroupFinding => ({
      feature: t.feature,
      products: t.products,
      catalogueShare: round3(t.catalogueShare),
      topShare: round3(t.topShare),
      representation: round3(t.representation),
      rate: { inGroup: round3(t.inRate), rest: round3(t.restRate), ratio: round3(t.rr.point), lo: round3(t.rr.lo), p: t.rr.p, q: q[i]! },
      status: q[i]! <= fdr && t.rr.lo > 1 ? "angle_mort" : t.rr.p < 0.05 && t.rr.point > 1 ? "a_surveiller" : "non_concluant",
    }))
    .sort((a, b) => order(a.status) - order(b.status) || a.rate.q - b.rate.q)
}
const order = (s: GroupFinding["status"]) => (s === "angle_mort" ? 0 : s === "a_surveiller" ? 1 : 2)
const round3 = (x: number) => Math.round(x * 1000) / 1000

/**
 * Correction loop. Rules come from blind-spot groups found on the TRAIN window only; each rule reserves `BS_RULE_SHARE` of the
 * reference group for the products carrying its feature in a ranking that uses train-window demand only, and the swapped
 * products are compared on the TEST window only. BH across rules. Nothing is applied.
 */
export function simulateCorrections(products: ReadonlyArray<BlindSpotProductInput>, now: Date, affiliateFeeBps: number | null = null): BlindSpotReport["simulation"] {
  const half = BLIND_SPOT_WINDOW_DAYS / 2
  const start = new Date(now.getTime() - BLIND_SPOT_WINDOW_DAYS * DAY)
  const cut = new Date(now.getTime() - half * DAY)
  // Baseline as it would have looked at the cut: demand of the 30 days before it, rise off (both rankings alike).
  const asOfCut = products.map((p) => ({ ...p, candidate: { ...p.candidate, paidOrders30d: demandIn(p, new Date(cut.getTime() - 30 * DAY), cut), rising: null } }))
  const { ranked } = rankGeneric(asOfCut.map((p) => p.candidate), affiliateFeeBps)
  const byId = new Map(asOfCut.map((p) => [p.candidate.productId, p]))
  const eligible = ranked.filter((it) => notEligibleReasons(it, byId.get(it.productId)!.candidate).length === 0)
  const k = topSizeOf(eligible.length)
  const empty = { trainDays: half, testDays: half, rules: [] as RuleResult[] }
  if (eligible.length <= k) return { ...empty, reason: "catalogue_trop_petit" }
  const rows = eligible.map((it, i) => {
    const p = byId.get(it.productId)!
    return { id: it.productId, idx: i, features: productFeatures(p.candidate, it), inTop: i < k, train: exposureOf(p, start, cut), test: exposureOf(p, cut, now) }
  })
  const trainGroups = detectGroups(rows.map((r) => ({ features: r.features, inTop: r.inTop, exposure: r.train })))
  const candidates = trainGroups.filter((g) => g.status !== "non_concluant").slice(0, 20)
  if (candidates.length === 0) return { ...empty, reason: "aucune_hypothese_sur_la_periode_d_apprentissage" }
  const results = candidates.map((g) => {
    const has = (r: (typeof rows)[number]) => new Set(featureKeys(r.features)).has(g.feature)
    const top = rows.slice(0, k)
    const quota = Math.ceil(k * BS_RULE_SHARE)
    const missingSlots = Math.max(0, quota - top.filter(has).length)
    const promoted = rows.slice(k).filter(has).slice(0, missingSlots)
    const withoutFeature = top.filter((r) => !has(r))
    const dropped = withoutFeature.slice(withoutFeature.length - promoted.length)
    const newTop = new Set([...top.filter((r) => !dropped.includes(r)), ...promoted].map((r) => r.id))
    const swappedIn = rows.filter((r) => newTop.has(r.id) && !r.inTop)
    const swappedOut = rows.filter((r) => !newTop.has(r.id) && r.inTop)
    const pin = pooled(swappedIn.map((r) => r.test))
    const pout = pooled(swappedOut.map((r) => r.test))
    const rr = rateRatio(pin.o, pin.e, pout.o, pout.e)
    const outRate = pout.e > 0 ? pout.o / pout.e : 0
    const regressions = swappedIn.filter((r) => (r.test.listingDays > 0 ? r.test.orders / r.test.listingDays : 0) < outRate).length
    const enough = rr && swappedIn.length >= BS_MIN_GROUP_PRODUCTS && pin.e >= BS_MIN_LISTING_DAYS && pout.e >= BS_MIN_LISTING_DAYS
    return { g, rr: enough ? rr : null, swappedIn: swappedIn.length, swappedOut: swappedOut.length, pin, pout, regressions }
  })
  const testedIdx = results.map((r, i) => (r.rr ? i : -1)).filter((i) => i >= 0)
  const q = benjaminiHochberg(testedIdx.map((i) => results[i]!.rr!.p))
  const qLow = benjaminiHochberg(testedIdx.map((i) => 1 - results[i]!.rr!.p))
  const qBy = new Map(testedIdx.map((i, j) => [i, { up: q[j]!, down: qLow[j]! }]))
  const rules = results.map((r, i): RuleResult => {
    const qq = qBy.get(i)
    const verdict: RuleResult["verdict"] = !r.rr || !qq
      ? "insuffisante"
      : qq.up <= BS_FDR && r.rr.lo > 1
        ? "meilleure"
        : qq.down <= BS_FDR && r.rr.hi < 1
          ? "moins_bonne"
          : "non_concluante"
    return {
      rule: `promouvoir ${r.g.feature}`,
      trainEvidence: { ratio: r.g.rate.ratio, p: r.g.rate.p, q: r.g.rate.q },
      swappedIn: r.swappedIn,
      swappedOut: r.swappedOut,
      test: r.rr && qq
        ? {
            inRatePer100: round3((r.pin.o / r.pin.e) * 100),
            outRatePer100: round3((r.pout.o / r.pout.e) * 100),
            ratio: round3(r.rr.point),
            lo: round3(r.rr.lo),
            hi: round3(r.rr.hi),
            p: r.rr.p,
            q: qq.up,
            inListingDays: Math.round(r.pin.e),
            outListingDays: Math.round(r.pout.e),
            inNetPerListingDayCents: Math.round(r.pin.net / r.pin.e),
            outNetPerListingDayCents: Math.round(r.pout.net / r.pout.e),
          }
        : null,
      regressions: r.regressions,
      verdict,
      applied: false,
    }
  })
  return { trainDays: half, testDays: half, rules, reason: null }
}

export function buildBlindSpotReport(
  products: ReadonlyArray<BlindSpotProductInput>,
  now: Date,
  opts: { truncated?: boolean; affiliateFeeBps?: number | null } = {},
): BlindSpotReport {
  const fee = opts.affiliateFeeBps ?? null
  const from = new Date(now.getTime() - BLIND_SPOT_WINDOW_DAYS * DAY)
  const byId = new Map(products.map((p) => [p.candidate.productId, p]))
  const { ranked, blocked } = rankGeneric(products.map((p) => p.candidate), fee)
  const eligibleItems = ranked.filter((it) => notEligibleReasons(it, byId.get(it.productId)!.candidate).length === 0)
  const k = topSizeOf(eligibleItems.length)
  const { rankCriterion } = selectionOrder(eligibleItems)
  const lastTop = eligibleItems[k - 1] ?? null
  const rankOf = new Map(eligibleItems.map((it, i) => [it.productId, i + 1]))
  const exposureBy = new Map(products.map((p) => [p.candidate.productId, exposureOf(p, from, now)]))
  const ref = pooled(eligibleItems.slice(0, k).map((it) => exposureBy.get(it.productId)!))

  const findings: ProductFinding[] = []
  const toTest: number[] = []
  for (const it of [...ranked, ...blocked]) {
    const p = byId.get(it.productId)!
    const e = exposureBy.get(it.productId)!
    const ne = notEligibleReasons(it, p.candidate)
    const rank = rankOf.get(it.productId) ?? null
    const inTop = rank != null && rank <= k
    const rr = ne.length === 0 && !inTop ? rateRatio(e.orders, e.listingDays, ref.o, ref.e) : null
    const missing: string[] = []
    if (e.listingDays < BS_MIN_LISTING_DAYS) missing.push("exposition_insuffisante")
    if (e.resellers < BS_MIN_RESELLERS) missing.push("trop_peu_de_revendeurs")
    if (e.orders < BS_MIN_ORDERS) missing.push("trop_peu_de_commandes")
    if (!p.proposals) missing.push("propositions_non_observees")
    if (p.candidate.offerMissingMeasured == null) missing.push("offre_non_mesuree")
    findings.push({
      productId: it.productId,
      name: e.resellers >= BS_MIN_RESELLERS ? p.candidate.name : null,
      genericRank: rank,
      inTop,
      status: ne.length ? "non_eligible" : "non_concluante",
      notEligible: ne,
      features: productFeatures(p.candidate, it),
      exposure: e,
      ratePer100: e.listingDays > 0 ? round3((e.orders / e.listingDays) * 100) : null,
      rateRatio: rr ? { ...rr, point: round3(rr.point), lo: round3(rr.lo), hi: round3(rr.hi), q: null } : null,
      netPerOrderCents: e.orders > 0 ? Math.round(e.netCents / e.orders) : null,
      whyBelow: !inTop && rank != null && lastTop ? rankCriterion(lastTop, it) : null,
      proposalBasis: p.proposals ? "observe" : "reproduit",
      proposals: p.proposals,
      missing,
    })
    if (rr && e.listingDays >= BS_MIN_LISTING_DAYS && e.resellers >= BS_MIN_RESELLERS && e.orders >= BS_MIN_ORDERS) toTest.push(findings.length - 1)
  }
  const q = benjaminiHochberg(toTest.map((i) => findings[i]!.rateRatio!.p))
  toTest.forEach((i, j) => (findings[i]!.rateRatio!.q = q[j]!))
  for (const f of findings) {
    if (f.status === "non_eligible") continue
    if (f.inTop) {
      f.status = "non_concluante" // the reference itself: not a blind spot by construction
      continue
    }
    f.status = judgeProduct(f.exposure, f.rateRatio, f.rateRatio?.q ?? null)
  }
  const statusCounts = { opportunite_confirmee: 0, signal_prometteur: 0, hypothese: 0, donnees_insuffisantes: 0, non_concluante: 0, non_eligible: 0 } as Record<BlindSpotStatus, number>
  for (const f of findings) if (!f.inTop) statusCounts[f.status]++
  const rankingBiases: Partial<Record<RankCriterion, number>> = {}
  for (const f of findings)
    if ((f.status === "opportunite_confirmee" || f.status === "signal_prometteur") && f.whyBelow) rankingBiases[f.whyBelow] = (rankingBiases[f.whyBelow] ?? 0) + 1
  const shown = findings
    .filter((f) => f.status === "opportunite_confirmee" || f.status === "signal_prometteur")
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "opportunite_confirmee" ? -1 : 1) || (a.rateRatio!.q ?? a.rateRatio!.p) - (b.rateRatio!.q ?? b.rateRatio!.p))
    .slice(0, 30)
  const groups = detectGroups(
    eligibleItems.map((it) => ({ features: productFeatures(byId.get(it.productId)!.candidate, it), inTop: rankOf.get(it.productId)! <= k, exposure: exposureBy.get(it.productId)! })),
  ).filter((g) => g.status !== "non_concluant")
  return {
    generatedAt: now.toISOString(),
    windowDays: BLIND_SPOT_WINDOW_DAYS,
    eligible: eligibleItems.length,
    notEligible: findings.length - eligibleItems.length,
    topSize: k,
    reference: { listingDays: Math.round(ref.e), orders: ref.o, ratePer100: ref.e > 0 ? round3((ref.o / ref.e) * 100) : null },
    statusCounts,
    products: shown,
    groups: groups.slice(0, 30),
    rankingBiases,
    simulation: opts.truncated ? { trainDays: BLIND_SPOT_WINDOW_DAYS / 2, testDays: BLIND_SPOT_WINDOW_DAYS / 2, rules: [], reason: "lecture_tronquee" } : simulateCorrections(products, now, fee),
    truncated: Boolean(opts.truncated),
    limits: [...BLIND_SPOT_LIMITS],
  }
}

/** `COPILOT_BLIND_SPOTS_MODE` = `off` (DEFAULT: nothing read) | `observe` (admin report readable). */
export function readBlindSpotsMode(env: Record<string, string | undefined> = process.env): "off" | "observe" {
  return env.COPILOT_BLIND_SPOTS_MODE?.trim() === "observe" ? "observe" : "off"
}

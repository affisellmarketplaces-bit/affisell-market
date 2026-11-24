/**
 * Temporal commercial intelligence — opportunities that analyses of TODAY's catalogue can not see (founder brief
 * 2026-11-24, portfolio row 37). PURE, OBSERVATION ONLY, changes no ranking.
 *
 * Input: the presence history of every listing (`ListingPresenceEvent` → `rebuildPresence`), each shop's own paid
 * orders of the product, and the product's eligibility TODAY (the blind-spot detector's own rule). Nothing else.
 *
 * What each figure is — never mixed:
 *  - PRESENCE (observed, `ListingPresenceEvent`): a listing was live in a shop between two recorded events;
 *  - AVAILABILITY: NOT historised (stock / pause / suspension over time are not recorded) — a listed period is never
 *    called « available »; the current eligibility is today's fact only;
 *  - EXPOSURE to buyers / TRAFFIC: not measured — never invented, never inferred from presence;
 *  - RANK: the copilot's order recomputed today (blind-spot detector), not a historical position;
 *  - SALES / NET (observed): paid orders of THAT shop paid while ITS listing was known to be listed, closed ones apart;
 *  - CALCULATIONS (rate ratios, thresholds) and HYPOTHESES (generated, then judged on later data) are labelled.
 *
 * A period with an unknown edge (before history, missing event) is never judged: an incomplete period is not a
 * commercial failure. A withdrawal is never presumed to be a mistake: its recorded source says whether the reseller
 * decided (`volontaire`), a platform / supplier rule did (`contrainte`), the product had a problem the reseller acted
 * on (`remplacement`), a script / import did (`technique`), or nobody declared it (`inconnue`). Only voluntary or
 * unknown withdrawals can be « too early »; constraints never.
 */
import { benjaminiHochberg, normalP } from "@/lib/reseller-copilot/learning"
import type { PresenceHistory, PresencePeriod } from "@/lib/listing-presence/periods"
import { rateRatio, type BlindSpotOrder, type BlindSpotStatus } from "@/lib/reseller-copilot/blind-spots"

const DAY = 86_400_000

/** A period shorter than this can not show whether a product sells (floor of the measured first-sale delay). */
export const TEMPORAL_MIN_OBSERVATION_DAYS = 14
/** Ceiling of the data-driven observation threshold (a measured delay above it is capped, said so). */
export const TEMPORAL_MAX_OBSERVATION_DAYS = 60
/** « Sold after a long time without any sale » = first sale of a period after this many listed days. */
export const TEMPORAL_LATE_SALE_DAYS = 30
export const TEMPORAL_MIN_RESELLERS = 3
export const TEMPORAL_MIN_LISTING_DAYS = 300
export const TEMPORAL_MIN_ORDERS = 5
export const TEMPORAL_FDR = 0.1
/** A product is named only from this many distinct resellers (aggregation threshold). */
export const TEMPORAL_NAME_MIN_RESELLERS = 3

export type WithdrawalReason = "volontaire" | "contrainte" | "remplacement" | "technique" | "inconnue"

export function withdrawalReason(source: string | null | undefined): WithdrawalReason {
  switch (source) {
    case "reseller_ui":
    case "reseller_bulk":
    case "reseller_remove":
      return "volontaire"
    case "replacement":
      return "remplacement"
    case "admin_review":
    case "exclusivity":
    case "supplier_withdrawal":
    case "account_deletion":
      return "contrainte"
    case "import":
    case "script":
    case "demo":
    case "admin":
    case "listing_create":
      return "technique"
    default:
      return "inconnue"
  }
}

export type TemporalListing = {
  productId: string
  affiliateId: string
  history: PresenceHistory
  /** THIS shop's paid orders of the product. */
  orders: readonly BlindSpotOrder[]
}

export type TemporalProduct = {
  productId: string
  name: string
  /** Sellable today by the blind-spot detector's own rule (blocked / low net / ≤ 3 units / unknown stock = false). */
  eligibleToday: boolean
}

/** One period as judged — only periods whose two edges are known (or still open) are measured. */
export type MeasuredPeriod = {
  productId: string
  affiliateId: string
  start: number
  end: number | null
  days: number
  orders: number
  closedOrders: number
  netCents: number
  firstSaleAfterDays: number | null
  ongoing: boolean
  isRelisting: boolean
  withdrawal: WithdrawalReason | null
  deleted: boolean
}

/** Periods with a KNOWN start; an uncertain period or one older than the history is left out (counted apart). */
export function measurePeriods(listing: TemporalListing, now: Date): { periods: MeasuredPeriod[]; unjudged: number } {
  const out: MeasuredPeriod[] = []
  let unjudged = 0
  let seenEnded = false
  const sorted = [...listing.orders].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
  for (const p of listing.history.periods as readonly PresencePeriod[]) {
    if (!p.startKnown || !p.start || p.uncertain || (!p.ongoing && !p.end)) {
      unjudged++
      if (!p.ongoing) seenEnded = true
      continue
    }
    const start = p.start.getTime()
    const end = p.end ? p.end.getTime() : null
    const stop = end ?? now.getTime()
    let orders = 0
    let closedOrders = 0
    let netCents = 0
    let first: number | null = null
    for (const o of sorted) {
      const ts = o.paidAt.getTime()
      if (ts < start || ts >= stop) continue
      if (o.closed) {
        closedOrders++
        continue
      }
      orders++
      netCents += o.netCents
      if (first == null) first = ts
    }
    out.push({
      productId: listing.productId,
      affiliateId: listing.affiliateId,
      start,
      end,
      days: (stop - start) / DAY,
      orders,
      closedOrders,
      netCents,
      firstSaleAfterDays: first == null ? null : (first - start) / DAY,
      ongoing: p.ongoing,
      isRelisting: seenEnded,
      withdrawal: p.ongoing ? null : withdrawalReason(p.endSource),
      deleted: Boolean(p.endedByDeletion),
    })
    if (!p.ongoing) seenEnded = true
  }
  return { periods: out, unjudged }
}

const quantile = (v: number[], q: number): number | null => {
  if (v.length === 0) return null
  const s = [...v].sort((a, b) => a - b)
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))
  return s[i]!
}
const round2 = (x: number) => Math.round(x * 100) / 100

/**
 * How long a listing must stay before « it does not sell » means anything — MEASURED, not assumed: the 75th percentile
 * of the first-sale delay over periods that sold, bounded to [14, 60] days. `basis: "plancher"` when too few sales.
 */
export function observationThreshold(periods: readonly MeasuredPeriod[]): { days: number; basis: "mesure" | "plancher" | "plafond"; sales: number } {
  const delays = periods.map((p) => p.firstSaleAfterDays).filter((d): d is number => d != null)
  if (delays.length < 20) return { days: TEMPORAL_MIN_OBSERVATION_DAYS, basis: "plancher", sales: delays.length }
  const q = quantile(delays, 0.75)!
  if (q > TEMPORAL_MAX_OBSERVATION_DAYS) return { days: TEMPORAL_MAX_OBSERVATION_DAYS, basis: "plafond", sales: delays.length }
  return { days: Math.max(TEMPORAL_MIN_OBSERVATION_DAYS, Math.ceil(q)), basis: q < TEMPORAL_MIN_OBSERVATION_DAYS ? "plancher" : "mesure", sales: delays.length }
}

export type TemporalFindingKind =
  | "retrait_premature_probable"
  | "opportunite_historique_invisible"
  | "vente_tardive"
  | "remises_en_vente_repetees"
  | "exposition_faussee"

export type TemporalFinding = {
  kind: TemporalFindingKind
  productId: string
  /** null below `TEMPORAL_NAME_MIN_RESELLERS` distinct resellers. */
  name: string | null
  status: BlindSpotStatus
  evidence: {
    resellers: number
    periods: number
    wellObservedListingDays: number
    wellObservedOrders: number
    ratePer100: number | null
    rateRatio: { point: number; lo: number; p: number; q: number | null } | null
    shortWithdrawals?: number
    withdrawalReasons?: Partial<Record<WithdrawalReason, number>>
    medianShortPeriodDays?: number | null
    medianFirstSaleDays?: number | null
    lateSales?: number
    relistedListings?: number
    liveOnlyListingDays?: number
    historyListingDays?: number
  }
  qualification: "observe" | "calcul" | "hypothese"
  why: string
}

export type TemporalReport = {
  generatedAt: string
  available: boolean
  trackingStartedAt: string | null
  scope: { listings: number; products: number; resellers: number; periodsMeasured: number; periodsUnjudged: number; periodsTooShort: number }
  observationThreshold: { days: number; basis: "mesure" | "plancher" | "plafond"; sales: number }
  reference: { listingDays: number; orders: number; ratePer100: number | null }
  comparisons: {
    /** Orders per 100 listed days of periods that ended in a VOLUNTARY withdrawal vs periods still on sale (well observed only). */
    keptVsWithdrawn: { keptRatePer100: number | null; withdrawnRatePer100: number | null; ratio: number | null; p: number | null; keptDays: number; withdrawnDays: number } | null
    /** Share of periods with ≥ 1 sale: relistings vs first periods (well observed only). */
    relistingVsFirst: { relistingShare: number | null; firstShare: number | null; z: number | null; relistings: number; first: number } | null
    withdrawalReasons: Record<WithdrawalReason, number>
  }
  findings: TemporalFinding[]
  hypotheses: TemporalHypothesis[]
  dataKinds: Record<"presence" | "disponibilite" | "exposition_acheteurs" | "position_classement" | "trafic" | "ventes", "observe" | "non_historise" | "non_mesure" | "reproduit_aujourdhui">
  limits: string[]
}

export type TemporalHypothesis = {
  id: "retraits_prematures_vendent_s_ils_restent" | "remises_en_vente_vendent_plus"
  generatedOn: { from: string; to: string; products: number }
  testedOn: { from: string; to: string }
  metric: string
  treated: { n: number; successes: number; share: number | null }
  control: { n: number; successes: number; share: number | null }
  z: number | null
  p: number | null
  q: number | null
  verdict: "confirmee" | "infirmee" | "non_concluante" | "insuffisante"
  applied: false
}

export const TEMPORAL_LIMITS = [
  "présence en boutique ≠ disponibilité : le stock, la pause et la suspension dans le temps ne sont pas historisés",
  "l'exposition réelle auprès des acheteurs et le trafic des boutiques ne sont pas mesurés",
  "une période dont un bord est inconnu (avant l'historique, événement manquant) n'est pas jugée",
  "la raison d'un retrait est celle que la base a enregistrée ; « inconnue » quand aucune source n'a été déclarée",
  "association observée, jamais une cause démontrée",
] as const

/** Aggregated rate over measured periods (well observed only when asked). */
function pool(periods: readonly MeasuredPeriod[]): { o: number; e: number } {
  let o = 0
  let e = 0
  for (const p of periods) {
    o += p.orders
    e += p.days
  }
  return { o, e }
}

const median = (v: number[]) => quantile(v, 0.5)

/** Statistical status of one product's well-observed rate vs the reference, same floors as the blind-spot detector. */
function judge(resellers: number, sellingResellers: number, e: number, o: number, rr: { point: number; lo: number; p: number } | null, q: number | null, concentrated: boolean): BlindSpotStatus {
  if (e < TEMPORAL_MIN_LISTING_DAYS || resellers < TEMPORAL_MIN_RESELLERS || o < TEMPORAL_MIN_ORDERS || !rr) return "donnees_insuffisantes"
  if (q != null && q <= TEMPORAL_FDR && rr.lo > 1 && sellingResellers >= TEMPORAL_MIN_RESELLERS && !concentrated) return "opportunite_confirmee"
  if (rr.p < 0.05 && rr.point > 1) return "signal_prometteur"
  if (rr.point > 1) return "hypothese"
  return "non_concluante"
}

export function buildTemporalReport(
  listings: readonly TemporalListing[],
  products: readonly TemporalProduct[],
  now: Date,
  opts: { trackingStartedAt: Date | null; truncated?: boolean } = { trackingStartedAt: null },
): TemporalReport {
  const empty = (available: boolean): TemporalReport => ({
    generatedAt: now.toISOString(),
    available,
    trackingStartedAt: opts.trackingStartedAt?.toISOString() ?? null,
    scope: { listings: 0, products: 0, resellers: 0, periodsMeasured: 0, periodsUnjudged: 0, periodsTooShort: 0 },
    observationThreshold: { days: TEMPORAL_MIN_OBSERVATION_DAYS, basis: "plancher", sales: 0 },
    reference: { listingDays: 0, orders: 0, ratePer100: null },
    comparisons: { keptVsWithdrawn: null, relistingVsFirst: null, withdrawalReasons: { volontaire: 0, contrainte: 0, remplacement: 0, technique: 0, inconnue: 0 } },
    findings: [],
    hypotheses: [],
    dataKinds: DATA_KINDS,
    limits: [...TEMPORAL_LIMITS, ...(opts.truncated ? ["lecture tronquée : aucune conclusion produite"] : [])],
  })
  if (!opts.trackingStartedAt) return empty(false)
  if (opts.truncated) return empty(true)

  const all: MeasuredPeriod[] = []
  let unjudged = 0
  for (const l of listings) {
    const m = measurePeriods(l, now)
    all.push(...m.periods)
    unjudged += m.unjudged
  }
  const threshold = observationThreshold(all)
  const T = threshold.days
  // « Well observed » = ongoing or finished periods that lasted at least T days; shorter finished ones are too short.
  const well = all.filter((p) => p.days >= T)
  const tooShort = all.filter((p) => !p.ongoing && p.days < T)
  const ref = pool(well)
  const reasons: Record<WithdrawalReason, number> = { volontaire: 0, contrainte: 0, remplacement: 0, technique: 0, inconnue: 0 }
  for (const p of all) if (p.withdrawal) reasons[p.withdrawal]++

  // Kept vs (voluntarily) withdrawn — did resellers withdraw what was selling less? (well observed only)
  const kept = pool(well.filter((p) => p.ongoing))
  const gone = pool(well.filter((p) => p.withdrawal === "volontaire"))
  const kvw = kept.e > 0 && gone.e > 0 ? rateRatio(gone.o, gone.e, kept.o, kept.e) : null
  const firstP = well.filter((p) => !p.isRelisting)
  const relP = well.filter((p) => p.isRelisting)
  const share = (v: MeasuredPeriod[]) => (v.length ? v.filter((p) => p.orders > 0).length / v.length : null)
  const zRel = relP.length && firstP.length ? twoProp(relP.filter((p) => p.orders > 0).length, relP.length, firstP.filter((p) => p.orders > 0).length, firstP.length) : null

  // Per product.
  const byProduct = new Map<string, MeasuredPeriod[]>()
  for (const p of all) byProduct.set(p.productId, [...(byProduct.get(p.productId) ?? []), p])
  const productBy = new Map(products.map((p) => [p.productId, p]))
  const liveBy = new Map<string, number>()
  const historyBy = new Map<string, number>()
  for (const p of all) {
    historyBy.set(p.productId, (historyBy.get(p.productId) ?? 0) + p.days)
    if (p.ongoing) liveBy.set(p.productId, (liveBy.get(p.productId) ?? 0) + p.days)
  }

  type Cand = { productId: string; kind: TemporalFindingKind; rr: ReturnType<typeof rateRatio>; ev: TemporalFinding["evidence"]; selling: number; concentrated: boolean; why: string }
  const tested: Cand[] = []
  const descriptive: TemporalFinding[] = []
  for (const [productId, ps] of byProduct) {
    const prod = productBy.get(productId)
    if (!prod) continue
    const resellers = new Set(ps.map((p) => p.affiliateId)).size
    const name = resellers >= TEMPORAL_NAME_MIN_RESELLERS ? prod.name : null
    const wellP = ps.filter((p) => p.days >= T)
    const own = pool(wellP)
    // Leave the product out of the reference it is compared with.
    const rr = own.e > 0 ? rateRatio(own.o, own.e, ref.o - own.o, ref.e - own.e) : null
    const sellers = new Map<string, number>()
    for (const p of wellP) if (p.orders > 0) sellers.set(p.affiliateId, (sellers.get(p.affiliateId) ?? 0) + p.orders)
    const concentrated = own.o > 0 && Math.max(0, ...sellers.values()) / own.o > 0.6
    const wellResellers = new Set(wellP.map((p) => p.affiliateId)).size
    const base = {
      resellers: wellResellers,
      periods: ps.length,
      wellObservedListingDays: Math.round(own.e),
      wellObservedOrders: own.o,
      ratePer100: own.e > 0 ? round2((own.o / own.e) * 100) : null,
      rateRatio: null as TemporalFinding["evidence"]["rateRatio"],
    }
    // 1. Withdrawn before it could show anything — voluntary / unknown only, never a constraint.
    const short = ps.filter((p) => !p.ongoing && p.days < T && p.orders === 0 && (p.withdrawal === "volontaire" || p.withdrawal === "inconnue"))
    const shortResellers = new Set(short.map((p) => p.affiliateId)).size
    if (prod.eligibleToday && short.length >= 2 && shortResellers >= 2) {
      const wr: Partial<Record<WithdrawalReason, number>> = {}
      for (const p of short) wr[p.withdrawal!] = (wr[p.withdrawal!] ?? 0) + 1
      tested.push({
        productId,
        kind: "retrait_premature_probable",
        rr,
        selling: sellers.size,
        concentrated,
        ev: { ...base, shortWithdrawals: short.length, withdrawalReasons: wr, medianShortPeriodDays: round2(median(short.map((p) => p.days)) ?? 0), medianFirstSaleDays: (() => { const m = median(wellP.map((p) => p.firstSaleAfterDays).filter((d): d is number => d != null)); return m == null ? null : round2(m) })() },
        why: "retiré sans vente avant la durée d'observation mesurée, alors qu'il vend là où il est resté",
      })
    }
    // 2. Sold well historically, sellable today, live nowhere: invisible to today's-catalogue analyses.
    if (prod.eligibleToday && !ps.some((p) => p.ongoing) && wellP.length > 0) {
      tested.push({ productId, kind: "opportunite_historique_invisible", rr, selling: sellers.size, concentrated, ev: base, why: "a vendu quand il était en boutique, vendable aujourd'hui, mais plus référencé nulle part" })
    }
    // 3. First sale after a long time without any — descriptive (patience signal), counts only.
    const late = ps.filter((p) => p.firstSaleAfterDays != null && p.firstSaleAfterDays >= TEMPORAL_LATE_SALE_DAYS)
    const lateResellers = new Set(late.map((p) => p.affiliateId)).size
    if (late.length >= 2 && lateResellers >= 2) {
      descriptive.push({ kind: "vente_tardive", productId, name, status: "hypothese", evidence: { ...base, lateSales: late.length }, qualification: "observe", why: `première vente après ${TEMPORAL_LATE_SALE_DAYS} jours ou plus de présence sans vente, dans plusieurs boutiques` })
    }
    // 4. Resellers coming back to it — descriptive.
    const relisted = new Set(ps.filter((p) => p.isRelisting).map((p) => p.affiliateId)).size
    if (relisted >= 2) {
      descriptive.push({ kind: "remises_en_vente_repetees", productId, name, status: "hypothese", evidence: { ...base, relistedListings: relisted }, qualification: "observe", why: "remis en vente après un retrait par plusieurs revendeurs" })
    }
    // 5. Today's-catalogue analyses see less than half of its real presence: comparisons with it are biased.
    const live = liveBy.get(productId) ?? 0
    const hist = historyBy.get(productId) ?? 0
    if (hist >= 60 && live < hist * 0.5) {
      descriptive.push({ kind: "exposition_faussee", productId, name, status: "hypothese", evidence: { ...base, liveOnlyListingDays: Math.round(live), historyListingDays: Math.round(hist) }, qualification: "calcul", why: "plus de la moitié de sa présence réelle tient à des référencements retirés : une analyse du catalogue actuel le sous-évalue" })
    }
  }
  const q = benjaminiHochberg(tested.map((c) => c.rr?.p ?? 1))
  const statFindings: TemporalFinding[] = tested.map((c, i) => {
    const prod = productBy.get(c.productId)!
    const status = judge(c.ev.resellers, c.selling, c.ev.wellObservedListingDays, c.ev.wellObservedOrders, c.rr, c.rr ? q[i]! : null, c.concentrated)
    return {
      kind: c.kind,
      productId: c.productId,
      name: new Set(byProduct.get(c.productId)!.map((p) => p.affiliateId)).size >= TEMPORAL_NAME_MIN_RESELLERS ? prod.name : null,
      status,
      evidence: { ...c.ev, rateRatio: c.rr ? { point: round2(c.rr.point), lo: round2(c.rr.lo), p: c.rr.p, q: q[i]! } : null },
      qualification: "calcul",
      why: c.why,
    }
  })
  const order: Record<BlindSpotStatus, number> = { opportunite_confirmee: 0, signal_prometteur: 1, hypothese: 2, donnees_insuffisantes: 3, non_concluante: 4, non_eligible: 5 }
  const findings = [...statFindings.filter((f) => f.status !== "non_concluante"), ...descriptive]
    .sort((a, b) => order[a.status] - order[b.status] || (a.evidence.rateRatio?.q ?? 1) - (b.evidence.rateRatio?.q ?? 1))
    .slice(0, 60)

  return {
    generatedAt: now.toISOString(),
    available: true,
    trackingStartedAt: opts.trackingStartedAt.toISOString(),
    scope: {
      listings: listings.length,
      products: byProduct.size,
      resellers: new Set(listings.map((l) => l.affiliateId)).size,
      periodsMeasured: all.length,
      periodsUnjudged: unjudged,
      periodsTooShort: tooShort.length,
    },
    observationThreshold: threshold,
    reference: { listingDays: Math.round(ref.e), orders: ref.o, ratePer100: ref.e > 0 ? round2((ref.o / ref.e) * 100) : null },
    comparisons: {
      keptVsWithdrawn: kvw ? { keptRatePer100: round2((kept.o / kept.e) * 100), withdrawnRatePer100: round2((gone.o / gone.e) * 100), ratio: round2(kvw.point), p: kvw.p, keptDays: Math.round(kept.e), withdrawnDays: Math.round(gone.e) } : null,
      relistingVsFirst: relP.length && firstP.length ? { relistingShare: share(relP), firstShare: share(firstP), z: zRel, relistings: relP.length, first: firstP.length } : null,
      withdrawalReasons: reasons,
    },
    findings,
    hypotheses: evaluateTemporalHypotheses(listings, products, now, opts.trackingStartedAt),
    dataKinds: DATA_KINDS,
    limits: [...TEMPORAL_LIMITS],
  }
}

const DATA_KINDS: TemporalReport["dataKinds"] = {
  presence: "observe",
  disponibilite: "non_historise",
  exposition_acheteurs: "non_mesure",
  position_classement: "reproduit_aujourdhui",
  trafic: "non_mesure",
  ventes: "observe",
}

function twoProp(a: number, na: number, b: number, nb: number): number {
  const p = (a + b) / (na + nb)
  const se = Math.sqrt(p * (1 - p) * (1 / na + 1 / nb))
  return se > 0 ? (a / na - b / nb) / se : 0
}

/**
 * The loop « generate → test on independent data ». The history is split at its midpoint: hypotheses are GENERATED
 * from periods that STARTED in the older half only, and JUDGED on periods that started in the newer half only (no
 * period is used on both sides). BH over the hypotheses tested. Nothing is applied.
 *  H1 — products withdrawn too early (older half) sell when a later listing stays at least the observation threshold:
 *       share of such later periods with a sale vs the same share for every other product.
 *  H2 — relistings sell more often than first listings (later half only, well-observed periods).
 */
export function evaluateTemporalHypotheses(listings: readonly TemporalListing[], products: readonly TemporalProduct[], now: Date, trackingStartedAt: Date): TemporalHypothesis[] {
  const mid = trackingStartedAt.getTime() + (now.getTime() - trackingStartedAt.getTime()) / 2
  const eligible = new Set(products.filter((p) => p.eligibleToday).map((p) => p.productId))
  const all = listings.flatMap((l) => measurePeriods(l, now).periods)
  const train = all.filter((p) => p.start < mid)
  const test = all.filter((p) => p.start >= mid)
  const T = observationThreshold(train).days
  const range = { generatedOn: { from: trackingStartedAt.toISOString(), to: new Date(mid).toISOString() }, testedOn: { from: new Date(mid).toISOString(), to: now.toISOString() } }
  const out: Array<Omit<TemporalHypothesis, "q" | "verdict"> & { lo?: number }> = []

  const early = new Set<string>()
  const byP = new Map<string, MeasuredPeriod[]>()
  for (const p of train) byP.set(p.productId, [...(byP.get(p.productId) ?? []), p])
  for (const [pid, ps] of byP) {
    const s = ps.filter((p) => !p.ongoing && p.days < T && p.orders === 0 && (p.withdrawal === "volontaire" || p.withdrawal === "inconnue"))
    if (eligible.has(pid) && s.length >= 2 && new Set(s.map((p) => p.affiliateId)).size >= 2) early.add(pid)
  }
  const longTest = test.filter((p) => p.days >= T)
  const tr = longTest.filter((p) => early.has(p.productId))
  const ct = longTest.filter((p) => !early.has(p.productId))
  out.push(hyp("retraits_prematures_vendent_s_ils_restent", early.size, range, `part des périodes d'au moins ${T} jours avec ≥ 1 vente`, tr, ct))
  const rel = longTest.filter((p) => p.isRelisting)
  const first = longTest.filter((p) => !p.isRelisting)
  out.push(hyp("remises_en_vente_vendent_plus", rel.length, range, `part des périodes d'au moins ${T} jours avec ≥ 1 vente (remises en vente vs premières périodes)`, rel, first))

  const testable = out.map((h, i) => (h.p != null ? i : -1)).filter((i) => i >= 0)
  const q = benjaminiHochberg(testable.map((i) => out[i]!.p!))
  const qBy = new Map(testable.map((i, j) => [i, q[j]!]))
  return out.map((h, i): TemporalHypothesis => {
    const qq = qBy.get(i) ?? null
    const verdict: TemporalHypothesis["verdict"] =
      h.p == null || qq == null ? "insuffisante" : qq <= TEMPORAL_FDR && (h.z ?? 0) > 0 ? "confirmee" : qq <= TEMPORAL_FDR && (h.z ?? 0) < 0 ? "infirmee" : "non_concluante"
    return { id: h.id, generatedOn: h.generatedOn, testedOn: h.testedOn, metric: h.metric, treated: h.treated, control: h.control, z: h.z, p: h.p, q: qq, verdict, applied: false }
  })
}

function hyp(
  id: TemporalHypothesis["id"],
  generatedProducts: number,
  range: { generatedOn: { from: string; to: string }; testedOn: { from: string; to: string } },
  metric: string,
  treated: MeasuredPeriod[],
  control: MeasuredPeriod[],
): Omit<TemporalHypothesis, "q" | "verdict"> {
  const ts = treated.filter((p) => p.orders > 0).length
  const cs = control.filter((p) => p.orders > 0).length
  // Floors: 20 periods from ≥ 5 resellers on each side; a hypothesis below them is « insuffisante », never judged.
  const enough =
    treated.length >= 20 && control.length >= 20 && new Set(treated.map((p) => p.affiliateId)).size >= 5 && new Set(control.map((p) => p.affiliateId)).size >= 5
  const z = enough ? twoProp(ts, treated.length, cs, control.length) : null
  return {
    id,
    generatedOn: { ...range.generatedOn, products: generatedProducts },
    testedOn: range.testedOn,
    metric,
    treated: { n: treated.length, successes: ts, share: treated.length ? round2(ts / treated.length) : null },
    control: { n: control.length, successes: cs, share: control.length ? round2(cs / control.length) : null },
    z: z == null ? null : round2(z),
    p: z == null ? null : normalP(z),
    applied: false,
  }
}

/** `COPILOT_TEMPORAL_MODE` = `off` (DEFAULT: nothing read) | `observe` (admin report readable). */
export function readTemporalMode(env: Record<string, string | undefined> = process.env): "off" | "observe" {
  return env.COPILOT_TEMPORAL_MODE?.trim() === "observe" ? "observe" : "off"
}

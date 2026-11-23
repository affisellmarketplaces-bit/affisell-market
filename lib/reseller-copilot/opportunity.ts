/**
 * RESELLER COPILOT — « pourquoi cette opportunité ? » (founder brief 2026-11-23). Pure, client-safe.
 *
 * The selection (selection.ts) already ranks the products a reseller can really sell by readiness, tested trend and
 * REAL net per sale at the reseller's OWN fee rate. This module reads each selected product along the six dimensions of
 * commercial standing — sheet rules, offer quality, availability, reseller net, distribution, sales — and says, in
 * qualified facts, which situation it is in and why it was proposed. Nothing here is a score, a forecast or a promise.
 *
 * Situations (`profile`, ONE per product, first rule wins — the order is the rule):
 *  1. `forte_demande_gain_faible`      demand observed (≥ 5 paid orders in 30 days, or a tested rise) but the net per sale
 *                                       at the suggested price is under the copilot's own threshold (`LOW_NET_CENTS`);
 *  2. `gain_faible`                     net under that threshold, without strong demand;
 *  3. `rentable_valide`                 net above it AND ≥ 5 paid orders in 30 days on Affisell (a commercial validation);
 *  4. `prometteur_peu_de_donnees`       on Affisell for less than 30 days: too early to judge demand — NEVER treated as weak;
 *  5. `rentable_demande_a_construire`   net above the threshold, older, few or no orders (the count is stated as a fact,
 *                                       never as « bad performance »).
 * Flags, independent of the profile: `sous_distribue` (≤ 1 reseller offers it: little competition), `tres_distribue`
 * (≥ 10 resellers), `risque_disponibilite` (≤ 3 units, or stock covering < 14 days at the marketplace's observed pace,
 * an ESTIMATE that needs ≥ 5 units sold), `fort_dans_sa_categorie` (top quarter of the paid orders among ≥ 5 products of
 * the SAME category in this reseller's catalogue — true there, said there, never generalised), `dans_votre_gamme` /
 * `hors_votre_gamme` (the suggested price vs the middle half of the reseller's own live selling prices, ≥ 5 listings).
 *
 * Qualifications: `fait` (Affisell's records or the published terms), `calcul` (computed from them), `estimation`
 * (a projection of an observed pace), `insuffisant` (the data does not exist yet). An absent datum is said absent.
 *
 * Confidentiality: only what a reseller may see — the published supplier price and commission, the public sheet,
 * marketplace COUNTS (orders, units, resellers listing), its own fee and its own prices. Never a supplier cost or margin,
 * never another reseller's identity, prices or figures (pinned by a test on the output's keys).
 */
import type { QualityFeature } from "@/lib/listing-quality/quality-effect"
import type { ResellerNet } from "@/lib/reseller-copilot/net-per-sale"

export type FactQualification = "fait" | "calcul" | "estimation" | "insuffisant"
export type Fact = { code: string; qualification: FactQualification; params?: Record<string, number | string> }

export type OpportunityProfile =
  | "forte_demande_gain_faible"
  | "gain_faible"
  | "rentable_valide"
  | "prometteur_peu_de_donnees"
  | "rentable_demande_a_construire"

export type OpportunityFlag = "sous_distribue" | "tres_distribue" | "risque_disponibilite" | "fort_dans_sa_categorie" | "dans_votre_gamme" | "hors_votre_gamme"

export type OpportunityAction = "ajouter" | "ajouter_surveiller_stock" | "decider_sur_le_gain" | "tester_avant_de_promouvoir"

export type RankCriterion = "readiness" | "rising" | "net" | "category_affinity" | "demand" | "tie"

export type Opportunity = {
  profile: OpportunityProfile
  flags: OpportunityFlag[]
  /** Pourquoi ce produit m'est-il recommandé ? */
  why: Fact[]
  /** Combien puis-je réellement gagner par vente ? (the net breakdown, at the reseller's own fee when known) */
  earnings: {
    netCents: number
    commissionCents: number
    markupCents: number
    affisellFeeCents: number
    feeBps: number
    /** True = the reseller has no negotiated rate: the platform default was applied (said). */
    feeIsDefault: boolean
    sellingPriceHtCents: number
    qualification: "calcul"
  }
  /** Ce qui rend l'opportunité intéressante. */
  strengths: Fact[]
  /** Ce qui manque encore. */
  missing: Fact[]
  /** Ce qui pourrait réduire la rentabilité. */
  risks: Fact[]
  /** Une action concrète. */
  action: OpportunityAction
  /** Pourquoi avant le suivant — the first criterion of the ranking that separates it from the next product. */
  rankedAbove?: { productId: string; name: string; criterion: RankCriterion }
}

export type OpportunityInput = {
  readiness: "pret" | "a_verifier" | "bloque"
  net: ResellerNet
  lowNetCents: number
  paidOrders30d: number
  /** Units sold on paid orders, marketplace, 30 days; null = not read. */
  units30d: number | null
  resellersListing: number
  rising: boolean
  stockUnits: number
  stockKnown: boolean
  /** Days since the product was created; null = unknown. */
  ageDays: number | null
  /** Sheet elements missing that have an ESTABLISHED marketplace association; null = no association established at all. */
  offerMissingMeasured: ReadonlyArray<{ feature: QualityFeature; lo: number }> | null
  /** Rank of its paid orders among products of the same category in this reseller's catalogue; null = not judged. */
  category: { name: string | null; peers: number; topQuarter: boolean } | null
  /** Middle half of the reseller's own live selling prices (HT cents); null = fewer than 5 listings. */
  priceBand: { p25: number; p75: number } | null
  fit: "your_categories" | "discovery" | null
}

export const VALIDATION_ORDERS_30D = 5
export const NEW_PRODUCT_DAYS = 30
export const UNDER_DISTRIBUTED_MAX = 1
export const HIGHLY_DISTRIBUTED_MIN = 10
export const LOW_STOCK_UNITS = 3
export const COVER_MIN_DAYS = 14
export const COVER_MIN_UNITS_SOLD = 5
export const CATEGORY_MIN_PEERS = 5
export const PRICE_BAND_MIN_LISTINGS = 5

/** Days of stock at the marketplace's observed pace; null when the pace is too thin to project (< 5 units in 30 days). */
export function coverDays(stockUnits: number, units30d: number | null): number | null {
  if (units30d == null || units30d < COVER_MIN_UNITS_SOLD) return null
  return Math.floor(stockUnits / (units30d / 30))
}

export function assessOpportunity(i: OpportunityInput): Opportunity {
  const lowNet = i.net.netCents < i.lowNetCents
  const strongDemand = i.paidOrders30d >= VALIDATION_ORDERS_30D || i.rising
  const isNew = i.ageDays != null && i.ageDays < NEW_PRODUCT_DAYS
  const profile: OpportunityProfile = lowNet
    ? strongDemand
      ? "forte_demande_gain_faible"
      : "gain_faible"
    : i.paidOrders30d >= VALIDATION_ORDERS_30D
      ? "rentable_valide"
      : isNew
        ? "prometteur_peu_de_donnees"
        : "rentable_demande_a_construire"

  const why: Fact[] = []
  const strengths: Fact[] = []
  const missing: Fact[] = []
  const risks: Fact[] = []
  const flags: OpportunityFlag[] = []
  const net = { net: i.net.netCents, threshold: i.lowNetCents }

  // Why: the facts that put it in the selection and in its situation.
  why.push({ code: i.readiness === "pret" ? "sellable_now" : "sellable_to_check", qualification: "fait" })
  why.push({ code: lowNet ? "net_below_threshold" : "net_above_threshold", qualification: "calcul", params: net })
  if (i.paidOrders30d > 0) why.push({ code: "orders_observed", qualification: "fait", params: { orders: i.paidOrders30d } })
  if (i.rising) why.push({ code: "rising_tested", qualification: "fait" })
  if (i.fit === "your_categories") why.push({ code: "in_your_categories", qualification: "fait" })
  if (i.fit === "discovery") why.push({ code: "discovery", qualification: "fait" })

  // Strengths.
  if (!lowNet) strengths.push({ code: "net_per_sale", qualification: "calcul", params: { net: i.net.netCents } })
  if (i.paidOrders30d >= VALIDATION_ORDERS_30D) strengths.push({ code: "validated_by_sales", qualification: "fait", params: { orders: i.paidOrders30d } })
  if (i.rising) strengths.push({ code: "rising_tested", qualification: "fait" })
  if (i.resellersListing <= UNDER_DISTRIBUTED_MAX) {
    flags.push("sous_distribue")
    strengths.push({ code: "little_competition", qualification: "fait", params: { resellers: i.resellersListing } })
  } else if (i.resellersListing >= HIGHLY_DISTRIBUTED_MIN) {
    flags.push("tres_distribue")
    risks.push({ code: "many_resellers", qualification: "fait", params: { resellers: i.resellersListing } })
  }
  if (i.category?.topQuarter && i.paidOrders30d > 0) {
    flags.push("fort_dans_sa_categorie")
    strengths.push({ code: "strong_in_category", qualification: "fait", params: { category: i.category.name ?? "—", peers: i.category.peers } })
  }
  if (i.priceBand) {
    const p = i.net.sellingPriceHtCents
    const inBand = p >= i.priceBand.p25 && p <= i.priceBand.p75
    flags.push(inBand ? "dans_votre_gamme" : "hors_votre_gamme")
    ;(inBand ? strengths : risks).push({ code: inBand ? "in_your_price_range" : "outside_your_price_range", qualification: "fait", params: { low: i.priceBand.p25, high: i.priceBand.p75 } })
  }

  // Risks to profitability.
  if (lowNet) risks.push({ code: "low_net", qualification: "calcul", params: net })
  if (i.net.belowSupplierPrice) risks.push({ code: "below_supplier_price", qualification: "calcul" })
  if (i.stockKnown) {
    const cover = coverDays(i.stockUnits, i.units30d)
    if (i.stockUnits <= LOW_STOCK_UNITS) {
      flags.push("risque_disponibilite")
      risks.push({ code: "low_stock", qualification: "fait", params: { units: i.stockUnits } })
    } else if (cover != null && cover < COVER_MIN_DAYS) {
      flags.push("risque_disponibilite")
      risks.push({ code: "short_cover", qualification: "estimation", params: { days: cover, units: i.stockUnits } })
    }
  }
  if (i.offerMissingMeasured && i.offerMissingMeasured.length > 0) {
    risks.push({ code: "offer_incomplete", qualification: "calcul", params: { count: i.offerMissingMeasured.length } })
  }

  // What is missing — absence of data said as such, never as weak performance.
  if (isNew) missing.push({ code: "too_recent", qualification: "insuffisant", params: { days: i.ageDays ?? 0 } })
  if (i.ageDays == null) missing.push({ code: "age_unknown", qualification: "insuffisant" })
  if (!i.stockKnown) missing.push({ code: "stock_unknown", qualification: "insuffisant" })
  else if (i.units30d != null && i.units30d < COVER_MIN_UNITS_SOLD && i.stockUnits > LOW_STOCK_UNITS) missing.push({ code: "cover_not_projectable", qualification: "insuffisant" })
  if (i.paidOrders30d === 0 && !isNew) missing.push({ code: "no_sales_yet", qualification: "insuffisant" })
  if (i.offerMissingMeasured == null) missing.push({ code: "offer_not_measured", qualification: "insuffisant" })
  if (i.net.feeIsDefault) missing.push({ code: "fee_default", qualification: "insuffisant", params: { pct: Math.round(i.net.feeBps / 100) } })
  if (i.category == null) missing.push({ code: "category_not_comparable", qualification: "insuffisant" })

  const action: OpportunityAction = lowNet
    ? "decider_sur_le_gain"
    : flags.includes("risque_disponibilite")
      ? "ajouter_surveiller_stock"
      : profile === "rentable_valide"
        ? "ajouter"
        : "tester_avant_de_promouvoir"

  return {
    profile,
    flags,
    why,
    earnings: {
      netCents: i.net.netCents,
      commissionCents: i.net.commissionCents,
      markupCents: i.net.markupCents,
      affisellFeeCents: i.net.affisellFeeCents,
      feeBps: i.net.feeBps,
      feeIsDefault: i.net.feeIsDefault,
      sellingPriceHtCents: i.net.sellingPriceHtCents,
      qualification: "calcul",
    },
    strengths,
    missing,
    risks,
    action,
  }
}

/** p25 / p75 of the reseller's own live selling prices (HT cents); null below `PRICE_BAND_MIN_LISTINGS`. */
export function priceBandOf(prices: ReadonlyArray<number>): { p25: number; p75: number } | null {
  const v = prices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b)
  if (v.length < PRICE_BAND_MIN_LISTINGS) return null
  const at = (q: number) => v[Math.min(v.length - 1, Math.max(0, Math.round(q * (v.length - 1))))]!
  return { p25: at(0.25), p75: at(0.75) }
}

/**
 * Per product: is it in the top quarter of paid orders among the products of the SAME category the reseller can offer?
 * Judged only with ≥ `CATEGORY_MIN_PEERS` products in that category, at least one of which sells (else nothing to compare).
 */
export function categoryStanding(
  items: ReadonlyArray<{ productId: string; categoryId: string | null; paidOrders30d: number }>,
  names: ReadonlyMap<string, string>,
): Map<string, { name: string | null; peers: number; topQuarter: boolean }> {
  const by = new Map<string, Array<{ productId: string; paidOrders30d: number }>>()
  for (const it of items) if (it.categoryId) by.set(it.categoryId, [...(by.get(it.categoryId) ?? []), it])
  const out = new Map<string, { name: string | null; peers: number; topQuarter: boolean }>()
  for (const [cat, list] of by) {
    if (list.length < CATEGORY_MIN_PEERS || !list.some((x) => x.paidOrders30d > 0)) continue
    const sorted = [...list].map((x) => x.paidOrders30d).sort((a, b) => b - a)
    const cut = sorted[Math.max(0, Math.ceil(list.length / 4) - 1)]!
    for (const x of list) out.set(x.productId, { name: names.get(cat) ?? null, peers: list.length, topQuarter: x.paidOrders30d > 0 && x.paidOrders30d >= cut })
  }
  return out
}

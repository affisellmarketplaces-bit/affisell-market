/**
 * RESELLER COPILOT — learning from real commercial results (founder brief 2026-11-23). Pure, client-safe.
 * OBSERVATION ONLY: nothing here changes the copilot's ranking; it measures, discovers and SIMULATES.
 *
 * 1. Snapshot — each product the copilot really served is frozen as it was presented (`ProposalSnapshot`, a CLOSED list
 *    of discrete fields: situation, flags, rank and why, readiness, net per sale and its method, availability, what was
 *    unknown, fit, bands of price / net / demand / competition / age / offer / shop size). Never recomputed later.
 * 2. Outcome — rapprochement with records Affisell already keeps, in THAT reseller's OWN shop (never the product's
 *    marketplace results): the listing's creation date (added or not), its paid orders within 30 days of the addition,
 *    units, revenue HT, the reseller's real net (`netAffiliateTransferCents`, what the transfer pays), orders later
 *    cancelled or refunded, days to first sale. Statuses never mixed:
 *      `observation_en_cours`   shown < 30 days ago, not added (yet) — not a refusal;
 *      `non_ajoute`             shown ≥ 30 days ago, not added within 30 days;
 *      `ajoute_fenetre_ouverte` added, its 30-day window not over — NEVER counted as a failure;
 *      `ajoute_sans_vente`      added, window over, no paid order;
 *      `vendu`                  ≥ 1 paid order not closed;
 *      `vendu_puis_annule`      paid orders, all later cancelled / refunded;
 *      `donnees_insuffisantes`  unreadable snapshot.
 * 3. Measure — per situation: adoption (shown → added) and, on MATURE additions only, the sale share (Wilson 95 %),
 *    orders, net and cancellations per addition, median days to first sale. A share is shown only with ≥ 20 cases from
 *    ≥ 5 resellers.
 * Every reading is an ASSOCIATION observed on products resellers chose to add after the copilot ranked them (position
 * bias, selection bias): never a demonstrated cause, never a forecast.
 */
import type { OpportunityFlag, OpportunityProfile } from "@/lib/reseller-copilot/opportunity"

export const LEARNING_WINDOW_DAYS = 30
export const LEARNING_MIN_CASES = 20
export const LEARNING_MIN_RESELLERS = 5
/** Snapshots and addition markers are kept this long, then purged (`planLearningPurge`). */
export const LEARNING_RETENTION_DAYS = 210
export const SNAPSHOT_METHOD = "reseller_net_v1" as const
const DAY = 86_400_000

export const LEARNED_PROFILES: readonly OpportunityProfile[] = [
  "forte_demande_gain_faible",
  "gain_faible",
  "rentable_valide",
  "prometteur_peu_de_donnees",
  "rentable_demande_a_construire",
]
const FLAGS: readonly OpportunityFlag[] = ["sous_distribue", "tres_distribue", "risque_disponibilite", "fort_dans_sa_categorie", "dans_votre_gamme", "hors_votre_gamme"]

// ---------------------------------------------------------------------------------------------------------------------
// Snapshot

export type Band = string
export type ProposalSnapshot = {
  v: 1
  method: typeof SNAPSHOT_METHOD
  profile: OpportunityProfile
  flags: OpportunityFlag[]
  rank: number
  rankCriterion: string | null
  readiness: "pret" | "a_verifier"
  netCents: number
  feeBps: number
  feeDefault: boolean
  availability: "ok" | "risque" | "inconnu"
  missing: string[]
  fit: "your_categories" | "discovery" | "none"
  categoryId: string | null
  priceBand: Band
  netBand: Band
  demandBand: Band
  competitionBand: Band
  ageBand: Band
  offerBand: Band
  rising: boolean
  shopBand: Band
}

export const SNAPSHOT_KEYS: readonly (keyof ProposalSnapshot)[] = [
  "v", "method", "profile", "flags", "rank", "rankCriterion", "readiness", "netCents", "feeBps", "feeDefault", "availability", "missing",
  "fit", "categoryId", "priceBand", "netBand", "demandBand", "competitionBand", "ageBand", "offerBand", "rising", "shopBand",
]

const band = (v: number | null | undefined, cuts: number[], labels: string[], unknown = "inconnu"): Band => {
  if (v == null || !Number.isFinite(v)) return unknown
  const i = cuts.findIndex((c) => v < c)
  return labels[i < 0 ? labels.length - 1 : i]!
}
export const priceBandOfCents = (c: number) => band(c / 100, [10, 25, 50, 100], ["<10", "10-25", "25-50", "50-100", "100+"])
export const netBandOfCents = (c: number) => band(c / 100, [2, 5, 10, 20], ["<2", "2-5", "5-10", "10-20", "20+"])
export const demandBandOf = (n: number) => band(n, [1, 5], ["0", "1-4", "5+"])
export const competitionBandOf = (n: number) => band(n, [2, 10], ["0-1", "2-9", "10+"])
export const ageBandOf = (d: number | null) => band(d, [30, 90], ["<30", "30-90", "90+"])
export const shopBandOf = (n: number | null) => band(n, [1, 10, 50], ["0", "1-9", "10-49", "50+"])

export type SnapshotInput = {
  profile: OpportunityProfile
  flags: readonly OpportunityFlag[]
  rank: number
  rankCriterion: string | null
  readiness: "pret" | "a_verifier"
  netCents: number
  feeBps: number
  feeDefault: boolean
  missing: readonly string[]
  fit: "your_categories" | "discovery" | null
  categoryId: string | null
  supplierPriceCents: number
  paidOrders30d: number
  resellersListing: number
  ageDays: number | null
  offerMissingMeasured: number | null
  rising: boolean
  stockKnown: boolean
  shopListings: number | null
}

export function buildSnapshot(i: SnapshotInput): ProposalSnapshot {
  return {
    v: 1,
    method: SNAPSHOT_METHOD,
    profile: i.profile,
    flags: [...i.flags],
    rank: Math.max(1, Math.round(i.rank)),
    rankCriterion: i.rankCriterion,
    readiness: i.readiness,
    netCents: Math.round(i.netCents),
    feeBps: Math.round(i.feeBps),
    feeDefault: i.feeDefault,
    availability: !i.stockKnown ? "inconnu" : i.flags.includes("risque_disponibilite") ? "risque" : "ok",
    missing: [...i.missing],
    fit: i.fit ?? "none",
    categoryId: i.categoryId,
    priceBand: priceBandOfCents(i.supplierPriceCents),
    netBand: netBandOfCents(i.netCents),
    demandBand: demandBandOf(i.paidOrders30d),
    competitionBand: competitionBandOf(i.resellersListing),
    ageBand: ageBandOf(i.ageDays),
    offerBand: i.offerMissingMeasured == null ? "inconnu" : i.offerMissingMeasured === 0 ? "complete" : "incomplete",
    rising: i.rising,
    shopBand: shopBandOf(i.shopListings),
  }
}

const STR = (v: unknown) => typeof v === "string"
export function parseSnapshot(p: unknown): ProposalSnapshot | null {
  if (!p || typeof p !== "object") return null
  const o = p as Record<string, unknown>
  if (o.v !== 1 || o.method !== SNAPSHOT_METHOD || !LEARNED_PROFILES.includes(o.profile as OpportunityProfile)) return null
  if (typeof o.rank !== "number" || !Number.isFinite(o.rank) || typeof o.netCents !== "number") return null
  for (const k of ["priceBand", "netBand", "demandBand", "competitionBand", "ageBand", "offerBand", "shopBand", "availability", "fit", "readiness"]) if (!STR(o[k])) return null
  return {
    v: 1,
    method: SNAPSHOT_METHOD,
    profile: o.profile as OpportunityProfile,
    flags: Array.isArray(o.flags) ? (o.flags.filter((f) => FLAGS.includes(f as OpportunityFlag)) as OpportunityFlag[]) : [],
    rank: o.rank,
    rankCriterion: STR(o.rankCriterion) ? (o.rankCriterion as string) : null,
    readiness: o.readiness === "a_verifier" ? "a_verifier" : "pret",
    netCents: o.netCents,
    feeBps: Number(o.feeBps) || 0,
    feeDefault: o.feeDefault === true,
    availability: o.availability as ProposalSnapshot["availability"],
    missing: Array.isArray(o.missing) ? (o.missing.filter(STR) as string[]) : [],
    fit: o.fit as ProposalSnapshot["fit"],
    categoryId: STR(o.categoryId) ? (o.categoryId as string) : null,
    priceBand: o.priceBand as string,
    netBand: o.netBand as string,
    demandBand: o.demandBand as string,
    competitionBand: o.competitionBand as string,
    ageBand: o.ageBand as string,
    offerBand: o.offerBand as string,
    rising: o.rising === true,
    shopBand: o.shopBand as string,
  }
}

/** Discrete features the discovery engine may combine — every one read from the FROZEN snapshot. */
export function snapshotFeatures(s: ProposalSnapshot): string[] {
  const rankBand = s.rank <= 3 ? "1-3" : s.rank <= 6 ? "4-6" : "7+"
  return [
    `situation=${s.profile}`,
    ...s.flags.map((f) => `repere=${f}`),
    `rang=${rankBand}`,
    `pret=${s.readiness}`,
    `dispo=${s.availability}`,
    `affinite=${s.fit}`,
    `prix=${s.priceBand}`,
    `gain=${s.netBand}`,
    `demande=${s.demandBand}`,
    `concurrence=${s.competitionBand}`,
    `anciennete=${s.ageBand}`,
    `offre=${s.offerBand}`,
    `progression=${s.rising ? "oui" : "non"}`,
    `taille_boutique=${s.shopBand}`,
    `frais=${s.feeDefault ? "standard" : "negocie"}`,
    ...(s.categoryId ? [`categorie=${s.categoryId}`] : []),
  ]
}

// ---------------------------------------------------------------------------------------------------------------------
// Outcome

export type ProposalStatus =
  | "observation_en_cours"
  | "non_ajoute"
  | "ajoute_fenetre_ouverte"
  | "ajoute_sans_vente"
  | "vendu"
  | "vendu_puis_annule"
  | "donnees_insuffisantes"

export type ShopOrder = { paidAt: Date; quantity: number; revenueHtCents: number; netCents: number; closed: boolean }

export type ProposalCase = {
  affiliateId: string
  productId: string
  shownAt: Date
  snapshot: ProposalSnapshot | null
  /** The reseller's listing of that product: creation date, or null when none exists. */
  listingCreatedAt: Date | null
  viaCopilot: boolean
  /** Paid orders of that product in THAT reseller's shop (any date; the window is applied here). */
  orders: ReadonlyArray<ShopOrder>
}

export type CaseOutcome = {
  status: ProposalStatus
  added: boolean
  orders: number
  units: number
  revenueHtCents: number
  netCents: number
  closedOrders: number
  daysToFirstSale: number | null
}

export function classifyCase(c: ProposalCase, now: Date): CaseOutcome {
  const empty: CaseOutcome = { status: "donnees_insuffisantes", added: false, orders: 0, units: 0, revenueHtCents: 0, netCents: 0, closedOrders: 0, daysToFirstSale: null }
  if (!c.snapshot) return empty
  const shown = c.shownAt.getTime()
  const win = LEARNING_WINDOW_DAYS * DAY
  const addedAt = c.listingCreatedAt && c.listingCreatedAt.getTime() >= shown && c.listingCreatedAt.getTime() <= shown + win ? c.listingCreatedAt : null
  if (!addedAt) return { ...empty, status: now.getTime() < shown + win ? "observation_en_cours" : "non_ajoute" }
  const start = addedAt.getTime()
  const inWin = c.orders.filter((o) => o.paidAt.getTime() >= start && o.paidAt.getTime() < start + win)
  const open = inWin.filter((o) => !o.closed)
  const first = inWin.length ? Math.min(...inWin.map((o) => o.paidAt.getTime())) : null
  const base: CaseOutcome = {
    status: "ajoute_fenetre_ouverte",
    added: true,
    orders: inWin.length,
    units: inWin.reduce((s, o) => s + Math.max(1, o.quantity), 0),
    revenueHtCents: open.reduce((s, o) => s + o.revenueHtCents, 0),
    netCents: open.reduce((s, o) => s + o.netCents, 0),
    closedOrders: inWin.length - open.length,
    daysToFirstSale: first == null ? null : Math.floor((first - start) / DAY),
  }
  if (now.getTime() < start + win) return base
  return { ...base, status: inWin.length === 0 ? "ajoute_sans_vente" : open.length === 0 ? "vendu_puis_annule" : "vendu" }
}

export const isMatureAdd = (o: CaseOutcome) => o.status === "ajoute_sans_vente" || o.status === "vendu" || o.status === "vendu_puis_annule"
export const isMatureProposal = (o: CaseOutcome) => o.status === "non_ajoute" || isMatureAdd(o)

// ---------------------------------------------------------------------------------------------------------------------
// Statistics

export function wilson(successes: number, n: number, z = 1.96): { lo: number; hi: number } {
  if (n <= 0) return { lo: 0, hi: 1 }
  const p = successes / n
  const d = 1 + (z * z) / n
  const c = p + (z * z) / (2 * n)
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return { lo: Math.max(0, (c - m) / d), hi: Math.min(1, (c + m) / d) }
}

export function twoProportionZ(a: number, na: number, b: number, nb: number): number {
  if (na <= 0 || nb <= 0) return 0
  const p = (a + b) / (na + nb)
  const se = Math.sqrt(p * (1 - p) * (1 / na + 1 / nb))
  return se > 0 ? (a / na - b / nb) / se : 0
}

/** Two-sided p-value of a standard normal z. */
export function normalP(z: number): number {
  const x = Math.abs(z) / Math.SQRT2
  // Abramowitz–Stegun 7.1.26 for erf
  const t = 1 / (1 + 0.3275911 * x)
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-x * x)
  return Math.max(0, Math.min(1, 1 - erf))
}

/** Benjamini–Hochberg adjusted q-values, same order as the input p-values. */
export function benjaminiHochberg(p: readonly number[]): number[] {
  const n = p.length
  const order = p.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
  const q = new Array<number>(n)
  let min = 1
  for (let k = n - 1; k >= 0; k--) {
    const [v, i] = order[k]!
    min = Math.min(min, (v * n) / (k + 1))
    q[i] = min
  }
  return q
}

const median = (v: number[]) => {
  if (v.length === 0) return null
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

// ---------------------------------------------------------------------------------------------------------------------
// Per-situation measure (what a reseller may be told)

export type SituationTrack = {
  profile: OpportunityProfile
  proposalsMature: number
  addedShare: number | null
  matureAdds: number
  resellers: number
  saleShare: number | null
  lo: number | null
  hi: number | null
  ordersPerAdd: number | null
  netPerAddCents: number | null
  cancelledShare: number | null
  medianDaysToFirstSale: number | null
  verdict: "insuffisant" | "mesure"
}

export type ScoredCase = { c: ProposalCase; o: CaseOutcome }

export function situationTracks(cases: ReadonlyArray<ScoredCase>, truncated = false): SituationTrack[] {
  return LEARNED_PROFILES.map((profile) => {
    const mine = cases.filter((x) => x.c.snapshot?.profile === profile)
    const matureProps = mine.filter((x) => isMatureProposal(x.o))
    const adds = mine.filter((x) => isMatureAdd(x.o))
    const resellers = new Set(adds.map((x) => x.c.affiliateId)).size
    const ok = !truncated && adds.length >= LEARNING_MIN_CASES && resellers >= LEARNING_MIN_RESELLERS
    const sold = adds.filter((x) => x.o.status === "vendu").length
    const w = wilson(sold, adds.length)
    const propResellers = new Set(matureProps.map((x) => x.c.affiliateId)).size
    const propOk = !truncated && matureProps.length >= LEARNING_MIN_CASES && propResellers >= LEARNING_MIN_RESELLERS
    const withOrders = adds.filter((x) => x.o.orders > 0)
    return {
      profile,
      proposalsMature: matureProps.length,
      addedShare: propOk ? matureProps.filter((x) => isMatureAdd(x.o)).length / matureProps.length : null,
      matureAdds: adds.length,
      resellers,
      saleShare: ok ? sold / adds.length : null,
      lo: ok ? w.lo : null,
      hi: ok ? w.hi : null,
      ordersPerAdd: ok ? adds.reduce((s, x) => s + x.o.orders, 0) / adds.length : null,
      netPerAddCents: ok ? Math.round(adds.reduce((s, x) => s + x.o.netCents, 0) / adds.length) : null,
      cancelledShare: ok && withOrders.length > 0 ? withOrders.reduce((s, x) => s + x.o.closedOrders, 0) / withOrders.reduce((s, x) => s + x.o.orders, 0) : null,
      medianDaysToFirstSale: ok ? median(adds.map((x) => x.o.daysToFirstSale).filter((d): d is number => d != null)) : null,
      verdict: ok ? "mesure" : "insuffisant",
    }
  })
}

export function trackForProfile(tracks: readonly SituationTrack[] | null, profile: OpportunityProfile): SituationTrack | null {
  return tracks?.find((t) => t.profile === profile) ?? null
}

// ---------------------------------------------------------------------------------------------------------------------
// Purge (retention) and mode

/** Rows older than the retention period, to delete. Pure: the caller decides whether to apply it. */
export function planLearningPurge(rows: ReadonlyArray<{ id: string; createdAt: Date }>, now: Date): string[] {
  const limit = now.getTime() - LEARNING_RETENTION_DAYS * DAY
  return rows.filter((r) => r.createdAt.getTime() < limit).map((r) => r.id)
}

/** `COPILOT_LEARNING_MODE` = `off` (DEFAULT: nothing recorded, nothing read) | `observe` (snapshots recorded, report readable, nothing shown to resellers) | `on` (+ measured situations shown to resellers). */
export function readCopilotLearningMode(env: Record<string, string | undefined> = process.env): "off" | "observe" | "on" {
  const v = env.COPILOT_LEARNING_MODE?.trim().toLowerCase()
  return v === "on" ? "on" : v === "observe" ? "observe" : "off"
}

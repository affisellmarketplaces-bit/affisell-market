import { referenceOf, type PlanTier } from "@/lib/reseller-copilot/observation-plan"
import { benjaminiHochberg, wilson } from "@/lib/reseller-copilot/learning"
import type { MeasuredPeriod } from "@/lib/reseller-copilot/temporal-opportunities"

/**
 * CONTEXT-AWARE OBSERVATION INTELLIGENCE — pure, no I/O.
 *
 * Question: « given this product, its context and the data really available, which observation horizon is reasonable
 * before judging it? » Answered only when the data DEFEND a personalised answer; otherwise the current rule stays.
 *
 * 1. FACTORS, each with its data class (`FACTORS`): `historise` = known at the decision AND reconstructible for past
 *    periods exactly (category, product age at the period start from `createdAt`, competing shops listed at the start
 *    from the presence history, relisting); `recalcule` = known at a decision made TODAY, but for past periods only
 *    today's value exists (supplier price band, offer completeness, extended return window) — usable at prediction
 *    time, label noise in training, said. Never used: what happens AFTER the start (`FUITES`: sales, demand now,
 *    sellable today, rise) and what is not recorded (`INCONNUS`: traffic, past availability, reseller price at start).
 * 2. CENSORING: the delay to the first sale is a survival time; a period still on sale or withdrawn without a sale is
 *    CENSORED at its length (never « will never sell », never a false failure). Kaplan–Meier, then the horizon = the
 *    time by which 75 % of the first sales that happen within 90 days have happened (`kmHorizon`), bounded [14, 60]
 *    and rounded to the week for a personalised value (no false precision).
 * 3. DISCOVERY on the OLDER half of the periods only (by start date): k-sample log-rank per factor and per pair,
 *    Benjamini–Hochberg 10 %, robust to leaving out the dominant reseller and the dominant category, levels with
 *    ≥ 20 first sales from ≥ 5 resellers, and a commercially meaningful effect (≥ 7 days from the general horizon).
 * 4. EVALUATION on the NEWER half only, every model fitted on the older half, the test period's own reseller removed
 *    from its reference: baseline = TODAY's rule (`referenceOf`: product → category → general, first sales only),
 *    general KM, category KM, category × price KM, contextual KM (retained factors, with fallback). Score = quantile
 *    (pinball, τ = 0.75) loss on observed first sales, compared PER PRODUCT (z ≥ 2, sign test p < 0.05, still z ≥ 2
 *    without the most favourable product, ≥ 6 products, ≥ 30 test sales) + calibration on periods with a complete
 *    follow-up (Wilson 95 % around 75 %). « meilleur » only when all hold — otherwise the contextual model stays
 *    experimental and the current rule is kept.
 * Aggregates only: a cell is used only with ≥ 20 first sales from ≥ 5 resellers; no reseller identity in any output.
 */

export const CH_CAP_DAYS = 90
export const CH_TAU = 0.75
export const CH_MIN_EVENTS = 20
export const CH_MIN_RESELLERS = 5
export const CH_MIN_EFFECT_DAYS = 7
export const CH_FDR = 0.1
export const CH_MIN_TEST_PRODUCTS = 6
export const CH_MIN_TEST_SALES = 30
export const CH_MODEL_VERSION = "ch-v1"
const MIN_H = 14
const MAX_H = 60

export type FactorKey = "categorie" | "anciennete" | "concurrence" | "remise_en_vente" | "prix" | "offre" | "retour"
export type DataClass = "historise" | "recalcule"
export const FACTORS: ReadonlyArray<{ key: FactorKey; dataClass: DataClass }> = [
  { key: "categorie", dataClass: "historise" },
  { key: "anciennete", dataClass: "historise" },
  { key: "concurrence", dataClass: "historise" },
  { key: "remise_en_vente", dataClass: "historise" },
  { key: "prix", dataClass: "recalcule" },
  { key: "offre", dataClass: "recalcule" },
  { key: "retour", dataClass: "recalcule" },
]
/** Would leak the future into a horizon computed at the add — never a factor. */
export const FUITES = ["ventes_de_la_periode", "demande_actuelle", "vendable_aujourd_hui", "tendance_actuelle", "duree_de_la_periode"] as const
/** Not recorded anywhere in Affisell — never invented. */
export const INCONNUS = ["trafic", "disponibilite_passee", "prix_revendeur_au_debut", "photos_au_debut"] as const

export const ageBand = (days: number | null): string => (days == null ? "inconnue" : days < 30 ? "<30j" : days < 180 ? "30-180j" : "180j+")
export const competitionBand = (others: number): string => (others <= 0 ? "seul" : others <= 2 ? "1-2" : "3+")
export const priceBand = (cents: number): string => (cents < 2500 ? "<25" : cents < 6000 ? "25-60" : "60+")

export type HorizonPeriod = {
  productId: string
  affiliateId: string
  start: number
  /** Observed length (to its end, or to now when still on sale). */
  days: number
  firstSaleAfterDays: number | null
  features: Record<FactorKey, string>
}

// ── Survival ────────────────────────────────────────────────────────────────────────────────────────────────────

type Obs = { t: number; event: boolean }
const obsOf = (p: Pick<HorizonPeriod, "days" | "firstSaleAfterDays">): Obs =>
  p.firstSaleAfterDays != null && p.firstSaleAfterDays <= CH_CAP_DAYS ? { t: Math.max(0, p.firstSaleAfterDays), event: true } : { t: Math.min(p.days, CH_CAP_DAYS), event: false }

/** Kaplan–Meier cumulative probability of a first sale, as steps (t, F(t)). */
export function kaplanMeier(obs: readonly Obs[]): Array<{ t: number; F: number }> {
  const s = [...obs].sort((a, b) => a.t - b.t || Number(b.event) - Number(a.event))
  let atRisk = s.length
  let surv = 1
  const out: Array<{ t: number; F: number }> = []
  let i = 0
  while (i < s.length) {
    const t = s[i]!.t
    let d = 0
    let c = 0
    while (i < s.length && s[i]!.t === t) {
      if (s[i]!.event) d++
      else c++
      i++
    }
    if (d > 0 && atRisk > 0) {
      surv *= 1 - d / atRisk
      out.push({ t, F: 1 - surv })
    }
    atRisk -= d + c
  }
  return out
}

/** Horizon = first time F(t) ≥ τ · F(cap): when 75 % of the first sales that happen within 90 days have happened. */
export function kmHorizon(obs: readonly Obs[], round = false): number | null {
  const km = kaplanMeier(obs)
  const fCap = km.length ? km[km.length - 1]!.F : 0
  if (fCap <= 0) return null
  const target = CH_TAU * fCap
  const hit = km.find((s) => s.F >= target - 1e-12)!
  const raw = Math.ceil(hit.t)
  const h = round ? Math.round(raw / 7) * 7 : raw
  return Math.min(MAX_H, Math.max(MIN_H, h))
}

const events = (ps: readonly HorizonPeriod[]) => ps.filter((p) => obsOf(p).event)
export function cellReliable(ps: readonly HorizonPeriod[]): boolean {
  const ev = events(ps)
  return ev.length >= CH_MIN_EVENTS && new Set(ev.map((p) => p.affiliateId)).size >= CH_MIN_RESELLERS
}

// ── Log-rank (k groups) ─────────────────────────────────────────────────────────────────────────────────────────

function lnGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5)
  let ser = 1.000000000190015
  for (const k of c) ser += k / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}
/** Upper regularised gamma Q(a, x) — the chi-square tail. */
function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1
  if (x < a + 1) {
    let sum = 1 / a
    let del = sum
    let ap = a
    for (let n = 0; n < 200; n++) {
      ap++
      del *= x / ap
      sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break
    }
    return Math.max(0, 1 - sum * Math.exp(-x + a * Math.log(x) - lnGamma(a)))
  }
  let b = x + 1 - a
  let c = 1 / 1e-300
  let d = 1 / b
  let h = d
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c
    if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-12) break
  }
  return Math.min(1, Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h)
}
export const chiSquareP = (x: number, df: number) => gammaQ(df / 2, x / 2)

function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((r, i) => [...r, b[i]!])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r
    if (Math.abs(M[p]![c]!) < 1e-12) return null
    ;[M[c], M[p]] = [M[p]!, M[c]!]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r]![c]! / M[c]![c]!
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!
    }
  }
  return M.map((r, i) => r[n]! / r[i]!)
}

/** k-sample log-rank test on the time to the first sale; null when fewer than 2 groups. */
export function logRank(groups: ReadonlyArray<readonly HorizonPeriod[]>): { chi2: number; df: number; p: number } | null {
  const gs = groups.filter((g) => g.length > 0).map((g) => g.map(obsOf))
  const k = gs.length
  if (k < 2) return null
  const times = [...new Set(gs.flatMap((g) => g.filter((o) => o.event).map((o) => o.t)))].sort((a, b) => a - b)
  const O = new Array(k).fill(0)
  const E = new Array(k).fill(0)
  const V = Array.from({ length: k }, () => new Array(k).fill(0))
  for (const t of times) {
    const n = gs.map((g) => g.filter((o) => o.t >= t).length)
    const d = gs.map((g) => g.filter((o) => o.event && o.t === t).length)
    const N = n.reduce((a, b) => a + b, 0)
    const D = d.reduce((a, b) => a + b, 0)
    if (N <= 1 || D === 0) continue
    for (let i = 0; i < k; i++) {
      O[i] += d[i]!
      E[i] += (D * n[i]!) / N
      for (let j = 0; j < k; j++) {
        const cov = ((D * (N - D)) / (N - 1)) * ((n[i]! / N) * ((i === j ? 1 : 0) - n[j]! / N))
        V[i]![j]! += cov
      }
    }
  }
  const U = O.slice(0, k - 1).map((o, i) => o - E[i]!)
  const Vr = V.slice(0, k - 1).map((r) => r.slice(0, k - 1))
  const x = solve(Vr, U)
  if (!x) return null
  const chi2 = Math.max(0, U.reduce((s, u, i) => s + u * x[i]!, 0))
  return { chi2, df: k - 1, p: chiSquareP(chi2, k - 1) }
}

// ── Discovery (older half) ──────────────────────────────────────────────────────────────────────────────────────

export type FactorLevel = { level: string; horizonDays: number | null; sales: number; resellers: number; direction: "plus_rapide" | "plus_tardif" | "proche" | "insuffisant" }
export type FactorFinding = {
  factor: string
  dataClass: DataClass
  levels: FactorLevel[]
  p: number | null
  q: number | null
  robust: boolean
  effectDays: number
  retained: boolean
  reason: "retenu" | "non_significatif" | "non_robuste" | "effet_trop_faible" | "niveaux_insuffisants"
  /** Same factor on the NEWER half: does its effect hold? */
  stability?: "confirme" | "non_confirme" | "inverse" | "insuffisant"
}

const keyOf = (p: HorizonPeriod, fs: readonly FactorKey[]) => fs.map((f) => p.features[f]).join("|")
function groupBy(ps: readonly HorizonPeriod[], fs: readonly FactorKey[]): Map<string, HorizonPeriod[]> {
  const m = new Map<string, HorizonPeriod[]>()
  for (const p of ps) {
    const k = keyOf(p, fs)
    m.set(k, [...(m.get(k) ?? []), p])
  }
  return m
}
const topBy = (ps: readonly HorizonPeriod[], f: (p: HorizonPeriod) => string) => {
  const c = new Map<string, number>()
  for (const p of ps) c.set(f(p), (c.get(f(p)) ?? 0) + 1)
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
}

function levelsOf(ps: readonly HorizonPeriod[], fs: readonly FactorKey[], general: number | null): { levels: FactorLevel[]; usable: HorizonPeriod[][] } {
  const levels: FactorLevel[] = []
  const usable: HorizonPeriod[][] = []
  for (const [level, g] of groupBy(ps, fs)) {
    const ev = events(g)
    const ok = cellReliable(g)
    const h = ok ? kmHorizon(g.map(obsOf)) : null
    const diff = h != null && general != null ? h - general : 0
    levels.push({
      level,
      horizonDays: h,
      sales: ev.length,
      resellers: new Set(ev.map((p) => p.affiliateId)).size,
      direction: !ok || h == null ? "insuffisant" : Math.abs(diff) < CH_MIN_EFFECT_DAYS ? "proche" : diff < 0 ? "plus_rapide" : "plus_tardif",
    })
    if (ok) usable.push(g)
  }
  return { levels: levels.sort((a, b) => b.sales - a.sales), usable }
}

export function discoverFactors(train: readonly HorizonPeriod[]): FactorFinding[] {
  const general = kmHorizon(train.map(obsOf))
  const candidates: Array<{ name: string; fs: FactorKey[]; dataClass: DataClass }> = FACTORS.map((f) => ({ name: f.key, fs: [f.key], dataClass: f.dataClass }))
  for (let i = 0; i < FACTORS.length; i++)
    for (let j = i + 1; j < FACTORS.length; j++)
      candidates.push({
        name: `${FACTORS[i]!.key}+${FACTORS[j]!.key}`,
        fs: [FACTORS[i]!.key, FACTORS[j]!.key],
        dataClass: FACTORS[i]!.dataClass === "historise" && FACTORS[j]!.dataClass === "historise" ? "historise" : "recalcule",
      })
  const tested = candidates.map((c) => {
    const { levels, usable } = levelsOf(train, c.fs, general)
    const lr = usable.length >= 2 ? logRank(usable) : null
    return { c, levels, usable, lr }
  })
  const ps = tested.filter((t) => t.lr).map((t) => t.lr!.p)
  const qs = benjaminiHochberg(ps)
  let qi = 0
  const domReseller = topBy(train, (p) => p.affiliateId)?.[0]
  const domCategory = topBy(train, (p) => p.features.categorie)?.[0]
  return tested.map((t) => {
    const q = t.lr ? qs[qi++]! : null
    const effectDays = general == null ? 0 : Math.max(0, ...t.levels.filter((l) => l.horizonDays != null).map((l) => Math.abs(l.horizonDays! - general)))
    let robust = false
    if (t.lr && q != null && q <= CH_FDR) {
      const without = (drop: (p: HorizonPeriod) => boolean) => {
        const sub = train.filter((p) => !drop(p))
        const { usable } = levelsOf(sub, t.c.fs, kmHorizon(sub.map(obsOf)))
        return usable.length >= 2 ? logRank(usable)?.p ?? 1 : 1
      }
      robust =
        without((p) => p.affiliateId === domReseller) < 0.05 &&
        (t.c.fs.includes("categorie") || without((p) => p.features.categorie === domCategory) < 0.05)
    }
    const reason: FactorFinding["reason"] =
      t.usable.length < 2 ? "niveaux_insuffisants" : q == null || q > CH_FDR ? "non_significatif" : !robust ? "non_robuste" : effectDays < CH_MIN_EFFECT_DAYS ? "effet_trop_faible" : "retenu"
    return { factor: t.c.name, dataClass: t.c.dataClass, levels: t.levels, p: t.lr ? round4(t.lr.p) : null, q: q == null ? null : round4(q), robust, effectDays, retained: reason === "retenu", reason }
  })
}
const round4 = (x: number) => Math.round(x * 10_000) / 10_000

/** The contextual model's factors: at most two retained single factors (or one retained pair), smallest q first. */
export function chooseFactors(findings: readonly FactorFinding[]): FactorKey[] {
  const singles = findings.filter((f) => f.retained && !f.factor.includes("+")).sort((a, b) => (a.q ?? 1) - (b.q ?? 1))
  const pairs = findings.filter((f) => f.retained && f.factor.includes("+")).sort((a, b) => (a.q ?? 1) - (b.q ?? 1))
  // A pair is used only when BOTH of its factors are retained on their own: a pair that is significant because one of
  // its factors is (category + competition, when only competition matters) adds nothing but thinner cells.
  const retainedSingles = new Set(singles.map((s) => s.factor))
  const pair = pairs.find((p) => p.factor.split("+").every((f) => retainedSingles.has(f)))
  if (pair) return pair.factor.split("+") as FactorKey[]
  return singles.slice(0, 2).map((s) => s.factor as FactorKey)
}

// ── Models ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type ModelKey = "baseline_actuelle" | "general" | "categorie" | "categorie_prix" | "contextuel"
export const MODELS: readonly ModelKey[] = ["baseline_actuelle", "general", "categorie", "categorie_prix", "contextuel"]

/** Prediction for one period from training periods; the period's own reseller is always removed first. */
export function predict(model: ModelKey, train: readonly HorizonPeriod[], target: HorizonPeriod, factors: readonly FactorKey[]): { horizonDays: number; basis: string } | null {
  const pool = train.filter((p) => p.affiliateId !== target.affiliateId)
  const general = () => {
    const h = kmHorizon(pool.map(obsOf))
    return h == null ? null : { horizonDays: h, basis: "general" }
  }
  const cell = (fs: readonly FactorKey[], round: boolean) => {
    const g = pool.filter((p) => fs.every((f) => p.features[f] === target.features[f]))
    if (!cellReliable(g)) return null
    const h = kmHorizon(g.map(obsOf), round)
    return h == null ? null : { horizonDays: h, basis: fs.join("+") }
  }
  switch (model) {
    case "baseline_actuelle": {
      const asMp = (ps: readonly HorizonPeriod[]) => ps as unknown as MeasuredPeriod[]
      const tiers: Array<[PlanTier, readonly HorizonPeriod[]]> = [
        ["product", pool.filter((p) => p.productId === target.productId)],
        ["category", pool.filter((p) => p.productId !== target.productId && p.features.categorie === target.features.categorie)],
        ["general", pool.filter((p) => p.productId !== target.productId)],
      ]
      for (const [tier, ps] of tiers) {
        const r = referenceOf(asMp(ps), tier)
        if (r) return { horizonDays: r.horizonDays, basis: tier }
      }
      return null
    }
    case "general":
      return general()
    case "categorie":
      return cell(["categorie"], false) ?? general()
    case "categorie_prix":
      return cell(["categorie", "prix"], false) ?? cell(["categorie"], false) ?? general()
    case "contextuel":
      if (factors.length === 0) return general()
      return cell(factors, true) ?? (factors.length > 1 ? cell([factors[0]!], true) : null) ?? general()
  }
}

// ── Evaluation (newer half) ─────────────────────────────────────────────────────────────────────────────────────

const pinball = (d: number, h: number) => (d - h) * (CH_TAU - (d < h ? 1 : 0))
/**
 * Scored only on periods followed for the WHOLE 90-day window: on shorter periods a late first sale is less often
 * observed than an early one, which would reward short horizons (censoring bias). Among them, the observed first
 * sales are an unbiased sample of the delays a horizon must cover.
 */
const completeFollowUp = (p: HorizonPeriod) => p.days >= CH_CAP_DAYS

export type ModelScore = {
  model: ModelKey
  predictions: number
  sales: number
  meanLoss: number | null
  /**
   * On complete follow-ups, horizons strictly inside the [14, 60] bounds only: at a bound the coverage can not be
   * 75 % by construction (the bound is a product rule) — those predictions are counted apart (`atBound`).
   */
  calibration: { complete: number; atBound: number; beforePct: number | null; lo: number | null; hi: number | null; verdict: "calibre" | "trop_court" | "trop_long" | "insuffisant" }
  outcomes: { soldBefore: number; soldAfter: number; noSaleComplete: number; censoredBefore: number }
}
export type ModelComparison = {
  model: ModelKey
  products: number
  meanGainPerProduct: number | null
  z: number | null
  signP: number | null
  zWithoutBest: number | null
  verdict: "meilleur" | "moins_bon" | "non_concluant" | "insuffisant"
}

function signTestP(pos: number, neg: number): number {
  const n = pos + neg
  if (n === 0) return 1
  const k = Math.max(pos, neg)
  let tail = 0
  for (let i = k; i <= n; i++) tail += Math.exp(lnChoose(n, i) - n * Math.LN2)
  return Math.min(1, 2 * tail)
}
const lnChoose = (n: number, k: number) => lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1)

function zOf(xs: readonly number[]): number | null {
  if (xs.length < 2) return null
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
  return sd > 0 ? m / (sd / Math.sqrt(xs.length)) : m > 0 ? Infinity : m < 0 ? -Infinity : 0
}

export function compareToBaseline(
  preds: ReadonlyMap<ModelKey, ReadonlyArray<{ period: HorizonPeriod; h: number }>>,
  model: ModelKey,
): ModelComparison {
  const base = new Map((preds.get("baseline_actuelle") ?? []).map((x) => [x.period, x.h]))
  const byProduct = new Map<string, number[]>()
  let sales = 0
  for (const { period, h } of preds.get(model) ?? []) {
    const o = obsOf(period)
    const hb = base.get(period)
    if (!completeFollowUp(period) || !o.event || hb == null) continue
    sales++
    byProduct.set(period.productId, [...(byProduct.get(period.productId) ?? []), pinball(o.t, hb) - pinball(o.t, h)])
  }
  const gains = [...byProduct.values()].map((g) => g.reduce((a, b) => a + b, 0) / g.length)
  if (gains.length < CH_MIN_TEST_PRODUCTS || sales < CH_MIN_TEST_SALES) {
    return { model, products: gains.length, meanGainPerProduct: null, z: null, signP: null, zWithoutBest: null, verdict: "insuffisant" }
  }
  const z = zOf(gains)
  const pos = gains.filter((g) => g > 1e-9).length
  const neg = gains.filter((g) => g < -1e-9).length
  const sp = signTestP(pos, neg)
  const sorted = [...gains].sort((a, b) => b - a)
  const zw = zOf(sorted.slice(1))
  const mean = gains.reduce((a, b) => a + b, 0) / gains.length
  const verdict: ModelComparison["verdict"] =
    z != null && z >= 2 && sp < 0.05 && zw != null && zw >= 2 && pos > neg ? "meilleur" : z != null && z <= -2 ? "moins_bon" : "non_concluant"
  const r2 = (x: number | null) => (x == null || !Number.isFinite(x) ? x : Math.round(x * 100) / 100)
  return { model, products: gains.length, meanGainPerProduct: r2(mean), z: r2(z), signP: round4(sp), zWithoutBest: r2(zw), verdict }
}

function score(model: ModelKey, list: ReadonlyArray<{ period: HorizonPeriod; h: number }>): ModelScore {
  let lossSum = 0
  let sales = 0
  let complete = 0
  let before = 0
  let atBound = 0
  const outcomes = { soldBefore: 0, soldAfter: 0, noSaleComplete: 0, censoredBefore: 0 }
  for (const { period, h } of list) {
    const o = obsOf(period)
    if (!completeFollowUp(period)) {
      if (!o.event && o.t < h) outcomes.censoredBefore++
      continue
    }
    if (o.event) {
      sales++
      lossSum += pinball(o.t, h)
      if (o.t <= h) outcomes.soldBefore++
      else outcomes.soldAfter++
      if (h <= MIN_H || h >= MAX_H) atBound++
      else {
        complete++
        if (o.t <= h) before++
      }
    } else outcomes.noSaleComplete++
  }
  let cal: ModelScore["calibration"] = { complete, atBound, beforePct: null, lo: null, hi: null, verdict: "insuffisant" }
  if (complete >= CH_MIN_TEST_SALES) {
    const w = wilson(before, complete)
    const verdict = CH_TAU > w.hi ? "trop_court" : CH_TAU < w.lo ? "trop_long" : "calibre"
    cal = { complete, atBound, beforePct: Math.round((before / complete) * 1000) / 10, lo: Math.round(w.lo * 1000) / 10, hi: Math.round(w.hi * 1000) / 10, verdict }
  }
  return { model, predictions: list.length, sales, meanLoss: sales ? Math.round((lossSum / sales) * 100) / 100 : null, calibration: cal, outcomes }
}

// ── Report ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type ContextualReport = {
  version: string
  available: boolean
  periods: number
  split: { trainPeriods: number; testPeriods: number; cutoff: string | null }
  controls: {
    censoredShare: number | null
    relistingShare: number | null
    topResellerShare: number | null
    topCategoryShare: number | null
  }
  generalHorizonDays: number | null
  factors: FactorFinding[]
  chosenFactors: FactorKey[]
  scores: ModelScore[]
  comparisons: ModelComparison[]
  contextualVerdict: "meilleur" | "experimental" | "abandonne" | "insuffisant"
  excluded: { fuites: readonly string[]; inconnus: readonly string[] }
  limits: readonly string[]
}
export const CH_LIMITS = [
  "association_pas_causalite",
  "trafic_non_mesure",
  "disponibilite_passee_non_historisee",
  "facteurs_recalcules_valeur_actuelle_pour_le_passe",
  "censure_traitee_par_kaplan_meier",
  "seule_la_moitie_recente_juge_les_modeles",
] as const

export function buildContextualReport(periods: readonly HorizonPeriod[]): ContextualReport {
  const sorted = [...periods].sort((a, b) => a.start - b.start)
  const share = (n: number) => (periods.length ? Math.round((n / periods.length) * 1000) / 1000 : null)
  const controls = {
    censoredShare: share(periods.filter((p) => !obsOf(p).event).length),
    relistingShare: share(periods.filter((p) => p.features.remise_en_vente === "oui").length),
    topResellerShare: share(topBy(periods, (p) => p.affiliateId)?.[1] ?? 0),
    topCategoryShare: share(topBy(periods, (p) => p.features.categorie)?.[1] ?? 0),
  }
  const base: Omit<ContextualReport, "factors" | "chosenFactors" | "scores" | "comparisons" | "contextualVerdict" | "split" | "generalHorizonDays"> = {
    version: CH_MODEL_VERSION,
    available: periods.length > 0,
    periods: periods.length,
    controls,
    excluded: { fuites: FUITES, inconnus: INCONNUS },
    limits: CH_LIMITS,
  }
  if (sorted.length < 2 * CH_MIN_EVENTS) {
    return { ...base, split: { trainPeriods: 0, testPeriods: 0, cutoff: null }, generalHorizonDays: kmHorizon(periods.map(obsOf)), factors: [], chosenFactors: [], scores: [], comparisons: [], contextualVerdict: "insuffisant" }
  }
  const mid = Math.floor(sorted.length / 2)
  const cutoff = sorted[mid]!.start
  const train = sorted.filter((p) => p.start < cutoff)
  const test = sorted.filter((p) => p.start >= cutoff)
  const factors = discoverFactors(train)
  for (const f of factors.filter((x) => x.retained)) {
    const fs = f.factor.split("+") as FactorKey[]
    const general = kmHorizon(test.map(obsOf))
    const { levels } = levelsOf(test, fs, general)
    const trainDir = new Map(f.levels.map((l) => [l.level, l.direction]))
    const comparable = levels.filter((l) => l.direction !== "insuffisant" && (trainDir.get(l.level) ?? "insuffisant") !== "insuffisant")
    f.stability =
      comparable.length === 0
        ? "insuffisant"
        : comparable.some((l) => (l.direction === "plus_rapide" && trainDir.get(l.level) === "plus_tardif") || (l.direction === "plus_tardif" && trainDir.get(l.level) === "plus_rapide"))
          ? "inverse"
          : comparable.some((l) => l.direction !== "proche" && l.direction === trainDir.get(l.level))
            ? "confirme"
            : "non_confirme"
  }
  const chosen = chooseFactors(factors)
  const preds = new Map<ModelKey, Array<{ period: HorizonPeriod; h: number }>>()
  const memo = new Map<string, ReturnType<typeof predict>>()
  for (const m of MODELS) {
    const list: Array<{ period: HorizonPeriod; h: number }> = []
    for (const p of test) {
      const k = `${m}|${p.affiliateId}|${p.productId}|${keyOf(p, FACTORS.map((f) => f.key))}`
      if (!memo.has(k)) memo.set(k, predict(m, train, p, chosen))
      const r = memo.get(k)!
      if (r) list.push({ period: p, h: r.horizonDays })
    }
    preds.set(m, list)
  }
  const comparisons = MODELS.filter((m) => m !== "baseline_actuelle").map((m) => compareToBaseline(preds, m))
  const ctx = comparisons.find((c) => c.model === "contextuel")!
  const scores = MODELS.map((m) => score(m, preds.get(m) ?? []))
  const calOk = (m: ModelKey) => {
    const s = scores.find((x) => x.model === m)!.calibration
    return s.beforePct == null ? null : Math.abs(s.beforePct / 100 - CH_TAU)
  }
  const ctxCal = calOk("contextuel")
  const baseCal = calOk("baseline_actuelle")
  const calibrationNotWorse = ctxCal != null && (baseCal == null || ctxCal <= baseCal + 0.05)
  const contextualVerdict: ContextualReport["contextualVerdict"] =
    chosen.length === 0 ? "abandonne" : ctx.verdict === "insuffisant" ? "insuffisant" : ctx.verdict === "meilleur" && calibrationNotWorse ? "meilleur" : "experimental"
  return {
    ...base,
    split: { trainPeriods: train.length, testPeriods: test.length, cutoff: new Date(cutoff).toISOString() },
    generalHorizonDays: kmHorizon(train.map(obsOf)),
    factors,
    chosenFactors: chosen,
    scores,
    comparisons,
    contextualVerdict,
  }
}

// ── Use in the observation plan (only when the validation says « meilleur ») ───────────────────────────────────

export type ContextualModelData = {
  version: string
  verdict: ContextualReport["contextualVerdict"]
  factors: FactorKey[]
  /** ALL periods (train + test): a validated model is refitted on everything before use. Server-side only. */
  periods: HorizonPeriod[]
}

export type ContextualHorizon = {
  horizonDays: number
  generalHorizonDays: number
  direction: "plus_tardif" | "plus_rapide"
  factors: Array<{ factor: FactorKey; level: string }>
  resellers: number
  sales: number
}

/**
 * A personalised horizon for a product about to be added — null unless the contextual model was validated, the cell
 * of its profile is reliable WITHOUT the asking reseller, and it differs from the general horizon by ≥ 7 days.
 * Inputs are what is known now: no future, no other reseller's identity in the output.
 */
export function contextualHorizonFor(model: ContextualModelData | null, features: Record<FactorKey, string>, excludeAffiliateId: string): ContextualHorizon | null {
  if (!model || model.verdict !== "meilleur" || model.version !== CH_MODEL_VERSION || model.factors.length === 0) return null
  const pool = model.periods.filter((p) => p.affiliateId !== excludeAffiliateId)
  const general = kmHorizon(pool.map(obsOf))
  if (general == null) return null
  for (const fs of [model.factors, model.factors.slice(0, 1)]) {
    if (fs.length === 0) continue
    const g = pool.filter((p) => fs.every((f) => p.features[f] === features[f]))
    if (!cellReliable(g)) continue
    const h = kmHorizon(g.map(obsOf), true)
    if (h == null || Math.abs(h - general) < CH_MIN_EFFECT_DAYS) return null
    const ev = events(g)
    return {
      horizonDays: h,
      generalHorizonDays: general,
      direction: h > general ? "plus_tardif" : "plus_rapide",
      factors: fs.map((f) => ({ factor: f, level: features[f] })),
      resellers: new Set(ev.map((p) => p.affiliateId)).size,
      sales: ev.length,
    }
  }
  return null
}

/** `CONTEXTUAL_HORIZON_MODE` = off (DEFAULT: nothing read) | observe (report only) | on (plan may use a VALIDATED model). */
export function readContextualMode(env: Record<string, string | undefined> = process.env): "off" | "observe" | "on" {
  const v = (env.CONTEXTUAL_HORIZON_MODE ?? "").trim().toLowerCase()
  return v === "observe" || v === "on" ? v : "off"
}

export const _internal = { obsOf }

// ── Continuous loop: daily snapshots and drift ──────────────────────────────────────────────────────────────────

export const CH_SNAPSHOT_ACTION = "copilot.contextual_horizon_snapshot"
export const chSnapshotId = (day: string) => `contextual-horizon:${day}`
export const CH_SNAPSHOT_KEYS = ["version", "day", "verdict", "chosenFactors", "retained", "contextualZ", "contextualCalibration", "baselineCalibration", "periods"] as const
export type ContextualSnapshot = {
  version: string
  day: string
  verdict: ContextualReport["contextualVerdict"]
  chosenFactors: string[]
  retained: string[]
  contextualZ: number | null
  contextualCalibration: string
  baselineCalibration: string
  periods: number
}
export function snapshotOf(r: ContextualReport, day: string): ContextualSnapshot {
  return {
    version: r.version,
    day,
    verdict: r.contextualVerdict,
    chosenFactors: [...r.chosenFactors],
    retained: r.factors.filter((f) => f.retained).map((f) => f.factor),
    contextualZ: r.comparisons.find((c) => c.model === "contextuel")?.z ?? null,
    contextualCalibration: r.scores.find((s) => s.model === "contextuel")?.calibration.verdict ?? "insuffisant",
    baselineCalibration: r.scores.find((s) => s.model === "baseline_actuelle")?.calibration.verdict ?? "insuffisant",
    periods: r.periods,
  }
}
export function parseSnapshot(raw: unknown): ContextualSnapshot | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (Object.keys(r).some((k) => !(CH_SNAPSHOT_KEYS as readonly string[]).includes(k))) return null
  if (typeof r.version !== "string" || typeof r.day !== "string" || !Array.isArray(r.retained) || !Array.isArray(r.chosenFactors)) return null
  return r as unknown as ContextualSnapshot
}

/**
 * Which factors stay useful over time and which lose it (same model version only): per factor, the days it was
 * retained over the recorded snapshots, whether it is retained in the latest one, and « perdu » when it was retained
 * on ≥ 3 earlier days and no longer is (the commercial context may have changed). Never re-tunes anything.
 */
export function factorDrift(snaps: readonly ContextualSnapshot[]): {
  snapshots: number
  verdicts: Record<string, number>
  factors: Array<{ factor: string; retainedDays: number; latest: boolean; state: "stable" | "nouveau" | "perdu" | "intermittent" }>
} {
  const s = [...snaps].filter((x) => x.version === CH_MODEL_VERSION).sort((a, b) => a.day.localeCompare(b.day))
  const latest = s.at(-1)
  const verdicts: Record<string, number> = {}
  for (const x of s) verdicts[x.verdict] = (verdicts[x.verdict] ?? 0) + 1
  const names = [...new Set(s.flatMap((x) => x.retained))]
  return {
    snapshots: s.length,
    verdicts,
    factors: names.map((factor) => {
      const days = s.filter((x) => x.retained.includes(factor)).length
      const now = Boolean(latest?.retained.includes(factor))
      const earlier = s.slice(0, -1).filter((x) => x.retained.includes(factor)).length
      const state = now && earlier === 0 ? "nouveau" : !now && earlier >= 3 ? "perdu" : now && days >= Math.max(3, Math.ceil(s.length * 0.8)) ? "stable" : "intermittent"
      return { factor, retainedDays: days, latest: now, state }
    }),
  }
}

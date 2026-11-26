/**
 * Historical exposure — how long a product was REALLY on sale in resellers' shops inside a window, read from the
 * listing presence history (`periods.ts`). PURE, client-safe, no import beyond `periods.ts`. Shared by the sheet-quality
 * measure, the copilot learning loop and the blind-spot detector: ONE definition of « a listed day ».
 *
 * Rules (never relaxed):
 *  - a listed day is a KNOWN listed day: a period with exact edges, or one whose unknown start is counted only from
 *    when history began. Days before history began, and days around a missing event (`uncertain` periods), are UNKNOWN —
 *    never listed, never unlisted;
 *  - withdrawn days are not exposure; a relisting opens a NEW period (no stretched period);
 *  - the periods of every listing of one shop are MERGED before counting (a deleted-then-recreated listing can never
 *    count the same instant twice);
 *  - an order counts for the exposure only if it was paid while THAT shop's listing was known to be listed;
 *  - every instant is a UTC epoch (`Date.getTime()`), intervals are half-open [start, end): an event at the same instant
 *    as another closes one interval and opens the next without overlap or gap.
 *
 * WHEN to use it (`windowCoverage`): coverage is judged PER WINDOW — history read in full AND begun at or before the
 * window's start. A history begun on 1 March covers a window starting on 2 March, not one starting on 1 February.
 * The migration being applied is not enough, and neither is a listing's first event (it is not its real start).
 */
import type { PresenceHistory } from "./periods"

const DAY = 86_400_000

export type HistoricalExposureMode = "off" | "observe" | "on"

/**
 * `HISTORICAL_EXPOSURE_MODE` = `off` (DEFAULT: nothing read, every analysis keeps its live-listing estimate) |
 * `observe` (presence read, old vs new compared and reported, verdicts still on the live estimate) | `on` (the presence
 * measure is used wherever the window is covered; elsewhere the live estimate, labelled). Founder decision.
 */
export function readHistoricalExposureMode(env: Record<string, string | undefined> = process.env): HistoricalExposureMode {
  const v = (env.HISTORICAL_EXPOSURE_MODE ?? "").trim().toLowerCase()
  return v === "observe" || v === "on" ? v : "off"
}

export type CoverageLevel =
  /** History available, read in full, begun at or before the window start. */
  | "complete"
  /** History begun INSIDE the window: the window's start is unknown. */
  | "partielle"
  /** History begun after the window ended (or at its end). */
  | "absente_sur_la_fenetre"
  /** Migration not applied / rolled back / unreadable. */
  | "indisponible"
  /** Capped read: never used partially. */
  | "lecture_tronquee"

export type WindowCoverage = { level: CoverageLevel; usable: boolean; trackingStartedAt: Date | null; from: Date; to: Date }

export function windowCoverage(read: { available: boolean; truncated: boolean; trackingStartedAt: Date | null } | null, from: Date, to: Date): WindowCoverage {
  const base = { trackingStartedAt: read?.trackingStartedAt ?? null, from, to }
  if (!read || !read.available || !read.trackingStartedAt) return { ...base, level: "indisponible", usable: false }
  if (read.truncated) return { ...base, level: "lecture_tronquee", usable: false }
  const ts = read.trackingStartedAt.getTime()
  if (ts <= from.getTime()) return { ...base, level: "complete", usable: true }
  if (ts < to.getTime()) return { ...base, level: "partielle", usable: false }
  return { ...base, level: "absente_sur_la_fenetre", usable: false }
}

export type Interval = readonly [number, number]

/** Known listed intervals of ONE history inside [from, to) — uncertain periods excluded. */
export function knownListedIntervals(h: PresenceHistory, from: Date, to: Date): Interval[] {
  if (h.status === "indisponible" || !h.observedFrom) return []
  const f = from.getTime()
  const t = to.getTime()
  const obs = h.observedFrom.getTime()
  const out: Array<[number, number]> = []
  for (const p of h.periods) {
    if (p.uncertain) continue
    const lo = Math.max(f, obs, p.start ? p.start.getTime() : obs)
    const hi = Math.min(t, p.end ? p.end.getTime() : t)
    if (hi > lo) out.push([lo, hi])
  }
  return out
}

/** Union of intervals (sorted, overlaps and touching edges merged). */
export function mergeIntervals(iv: ReadonlyArray<Interval>): Interval[] {
  const s = [...iv].filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  const out: Array<[number, number]> = []
  for (const [a, b] of s) {
    const last = out[out.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

/** Length of the part of `iv` (merged) that is NOT covered by `minus` (merged). */
function lengthMinus(iv: ReadonlyArray<Interval>, minus: ReadonlyArray<Interval>): number {
  let total = 0
  for (const [a, b] of iv) {
    let len = b - a
    for (const [c, d] of minus) len -= Math.max(0, Math.min(b, d) - Math.max(a, c))
    total += Math.max(0, len)
  }
  return total
}

/** Unknown-presence intervals of one history inside [from, to): before history began + uncertain periods. */
function unknownIntervals(h: PresenceHistory, from: Date, to: Date): Interval[] {
  const f = from.getTime()
  const t = to.getTime()
  if (h.status === "indisponible" || !h.observedFrom) return t > f ? [[f, t]] : []
  const obs = h.observedFrom.getTime()
  const out: Array<[number, number]> = []
  // Before history began: only when the listing may have existed (its unknown start is bounded by its creation).
  if (obs > f) {
    const first = h.periods[0]
    const lower = first && !first.startKnown && first.startLowerBound ? first.startLowerBound.getTime() : obs
    if (Math.min(t, obs) > Math.max(f, lower)) out.push([Math.max(f, lower), Math.min(t, obs)])
  }
  for (const p of h.periods) {
    if (!p.uncertain) continue
    const lo = Math.max(f, obs, p.start ? p.start.getTime() : obs)
    const hi = Math.min(t, p.end ? p.end.getTime() : t)
    if (hi > lo) out.push([lo, hi])
  }
  return out
}

export type ShopExposure = {
  affiliateId: string
  /** Merged known listed intervals of every listing of this shop for the product. */
  intervals: Interval[]
  listedDays: number
  /** Unknown days NOT already known as listed (merged), so a shop never counts a day twice. */
  unknownDays: number
  /** Periods (of this shop) touching the window; withdrawals and relistings whose event falls in the window. */
  periods: number
  withdrawals: number
  relistings: number
  /** A history of this shop is `incoherent` (an event is missing). */
  anomaly: boolean
}

/** Exposure of one product in [from, to), shop by shop. */
export function shopExposures(histories: ReadonlyArray<{ affiliateId: string; history: PresenceHistory }>, from: Date, to: Date): ShopExposure[] {
  const by = new Map<string, Array<{ affiliateId: string; history: PresenceHistory }>>()
  for (const x of histories) by.set(x.affiliateId, [...(by.get(x.affiliateId) ?? []), x])
  const f = from.getTime()
  const t = to.getTime()
  const out: ShopExposure[] = []
  for (const [affiliateId, list] of by) {
    const intervals = mergeIntervals(list.flatMap((x) => knownListedIntervals(x.history, from, to)))
    const unknown = mergeIntervals(list.flatMap((x) => unknownIntervals(x.history, from, to)))
    let periods = 0
    let withdrawals = 0
    let relistings = 0
    for (const { history: h } of list) {
      let seenPeriod = false
      for (const p of h.periods) {
        const ps = p.start ? p.start.getTime() : -Infinity
        const pe = p.end ? p.end.getTime() : Infinity
        if (pe > f && ps < t) periods++
        if (p.end && !p.uncertain && pe >= f && pe < t) withdrawals++
        if (seenPeriod && p.start && p.startKnown && ps >= f && ps < t) relistings++
        seenPeriod = true
      }
    }
    out.push({
      affiliateId,
      intervals,
      listedDays: round2(intervals.reduce((a, [lo, hi]) => a + (hi - lo), 0) / DAY),
      unknownDays: round2(lengthMinus(unknown, intervals) / DAY),
      periods,
      withdrawals,
      relistings,
      anomaly: list.some((x) => x.history.status === "incoherent"),
    })
  }
  return out
}

export const inIntervals = (iv: ReadonlyArray<Interval>, ts: number) => iv.some(([lo, hi]) => ts >= lo && ts < hi)

/** Listed days accumulated in `iv` strictly before `ts` (the exposure a product had when it sold). */
export function listedDaysBefore(iv: ReadonlyArray<Interval>, ts: number): number {
  let ms = 0
  for (const [lo, hi] of iv) if (lo < ts) ms += Math.min(hi, ts) - lo
  return round2(ms / DAY)
}

/** Index of the merged interval containing `ts` (-1 = none). Interval 0 = first known period in the window. */
export const intervalIndexOf = (iv: ReadonlyArray<Interval>, ts: number) => iv.findIndex(([lo, hi]) => ts >= lo && ts < hi)

export type ExposureReliability = "fiable" | "partielle" | "incertaine"

/**
 * How coverage and reliability fit together (founder brief 2026-11-24 « launch gate » §5):
 *  - `windowCoverage` = TECHNICAL coverage of the window: history read in full and begun ≤ the window start. Under it,
 *    no day of the window lies before history, so the ONLY way a product or case can still have unknown time is a
 *    missing event (an `incoherent` history around the window).
 *  - `exposureReliability` = whether THAT product's / case's own time is fully documented. The tolerance is ZERO: one
 *    unknown day, or a missing event, and it is not « fiable » — so it is left out of every measure, never counted on the
 *    known days only and presented as documented. (Until 2026-11-24 a 10 % tolerance existed; under complete coverage
 *    it could only ever admit time made unknown by a missing event — removed rather than kept as a silent exception.)
 *  - Neither is STATISTICAL quality: a fully documented window can still hold too few periods, resellers or sales —
 *    that is each engine's floors and the data-maturity dimensions (lib/launch-gate/data-maturity.ts).
 */
export const EXPOSURE_UNKNOWN_TOLERANCE = 0
export function exposureReliability(listedDays: number, unknownDays: number, anomaly = false): ExposureReliability {
  const total = listedDays + unknownDays
  if (total <= 0) return anomaly ? "incertaine" : "fiable"
  const share = unknownDays / total
  if (unknownDays <= 0 && share <= EXPOSURE_UNKNOWN_TOLERANCE && !anomaly) return "fiable"
  if (share <= 0.5) return "partielle"
  return "incertaine"
}

// ── Old vs new ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Within ± 1 day (or ± 5 %) the two methods are said to agree. */
export const EXPOSURE_AGREE_DAYS = 1
export const EXPOSURE_AGREE_SHARE = 0.05

export type ExposureComparison = {
  units: number
  liveDays: number
  historicalDays: number
  /** live > history: the live estimate counts withdrawn gaps of a listing still on sale (created long ago, relisted). */
  overestimated: number
  /** live < history: listings withdrawn or deleted before today are invisible to the live estimate. */
  underestimated: number
  agree: number
  /** Units the live estimate gives no day at all although history shows real listed days. */
  missedByLive: number
  /** Median of history / live over units where both are > 0 (null = none). */
  medianRatio: number | null
  /** Orders the live reading attributes but history puts outside every known listed period of their shop. */
  ordersOutsideKnownPeriods: number
}

export function compareExposureMethods(rows: ReadonlyArray<{ liveDays: number; historicalDays: number; ordersOutsideKnownPeriods?: number }>): ExposureComparison {
  let over = 0
  let under = 0
  let agree = 0
  let missed = 0
  let outside = 0
  const ratios: number[] = []
  for (const r of rows) {
    const d = r.liveDays - r.historicalDays
    const tol = Math.max(EXPOSURE_AGREE_DAYS, EXPOSURE_AGREE_SHARE * Math.max(r.liveDays, r.historicalDays))
    if (Math.abs(d) <= tol) agree++
    else if (d > 0) over++
    else under++
    if (r.liveDays <= 0 && r.historicalDays > 0) missed++
    if (r.liveDays > 0 && r.historicalDays > 0) ratios.push(r.historicalDays / r.liveDays)
    outside += r.ordersOutsideKnownPeriods ?? 0
  }
  ratios.sort((a, b) => a - b)
  const m = ratios.length === 0 ? null : ratios.length % 2 ? ratios[(ratios.length - 1) / 2]! : (ratios[ratios.length / 2 - 1]! + ratios[ratios.length / 2]!) / 2
  return {
    units: rows.length,
    liveDays: round1(rows.reduce((a, r) => a + r.liveDays, 0)),
    historicalDays: round1(rows.reduce((a, r) => a + r.historicalDays, 0)),
    overestimated: over,
    underestimated: under,
    agree,
    missedByLive: missed,
    medianRatio: m == null ? null : Math.round(m * 1000) / 1000,
    ordersOutsideKnownPeriods: outside,
  }
}

const round2 = (x: number) => Math.round(x * 100) / 100
const round1 = (x: number) => Math.round(x * 10) / 10

// ── Lifecycle profile: when does a listing stop selling, does a relisting change it? (descriptive, floors) ────────

/** Age of a listing period (days since ITS OWN known start): 0–14, 14–45, 45+. */
export const LIFECYCLE_AGE_BANDS = [
  { band: "0-14", lo: 0, hi: 14 },
  { band: "14-45", lo: 14, hi: 45 },
  { band: "45+", lo: 45, hi: Infinity },
] as const
export type LifecycleBand = (typeof LIFECYCLE_AGE_BANDS)[number]["band"]
export const LIFECYCLE_MIN_LISTED_DAYS = 300
export const LIFECYCLE_MIN_RESELLERS = 5
export const LIFECYCLE_MIN_ORDERS = 5

export type LifecycleCell = {
  listedDays: number
  orders: number
  resellers: number
  /** Paid orders per 100 listed days; null below the floors. */
  ratePer100: number | null
  /** Rate ratio vs the reference cell (95 % interval, log-Poisson, +0.5 continuity); null below the floors. */
  ratioVsReference: number | null
  lo: number | null
  hi: number | null
  reading: "insuffisant" | "plus_haut" | "plus_bas" | "non_concluant" | "reference"
}

export type LifecycleProfile = {
  /** By age of the period, reference = « 0-14 » (the first two weeks of a period). */
  byAge: Record<LifecycleBand, LifecycleCell>
  /** First known period of a listing vs a period opened by a relisting; reference = first. */
  firstPeriod: LifecycleCell
  relisted: LifecycleCell
  /** Periods whose start is unknown (began before history) are left out: their age is unknown. */
  periodsLeftOut: number
  nature: "association_observee"
  limits: readonly string[]
}

export const LIFECYCLE_LIMITS = [
  "survie_des_annonces_longues", // a period that lasts is a period a reseller kept — often because it sells
  "presence_n_est_pas_trafic",
  "disponibilite_non_historisee",
  "saison_non_neutralisee",
] as const

type Acc = { ms: number; orders: number; resellers: Set<string> }
const acc = (): Acc => ({ ms: 0, orders: 0, resellers: new Set() })

/**
 * Inputs: every listing history (any product), with its shop, and the paid non-closed orders of those shops. Only
 * periods with a KNOWN start and not uncertain are profiled; each period is clipped to [from, to) and to its own end.
 */
export function lifecycleProfile(
  listings: ReadonlyArray<{ affiliateId: string; productId: string; history: PresenceHistory }>,
  orders: ReadonlyArray<{ affiliateId: string; productId: string; paidAt: Date }>,
  from: Date,
  to: Date,
): LifecycleProfile {
  const f = from.getTime()
  const t = to.getTime()
  const age = new Map<LifecycleBand, Acc>(LIFECYCLE_AGE_BANDS.map((b) => [b.band, acc()]))
  const first = acc()
  const relisted = acc()
  let leftOut = 0
  const ordersBy = new Map<string, number[]>()
  for (const o of orders) {
    const k = `${o.affiliateId}\u0000${o.productId}`
    ordersBy.set(k, [...(ordersBy.get(k) ?? []), o.paidAt.getTime()])
  }
  const claimed = new Set<string>() // an order is counted once, even if two listings of one shop could claim it
  for (const l of listings) {
    const k = `${l.affiliateId}\u0000${l.productId}`
    const sales = ordersBy.get(k) ?? []
    let index = 0
    for (const p of l.history.periods) {
      const isFirst = index === 0
      index++
      if (!p.start || !p.startKnown || p.uncertain) {
        if (p.uncertain || !p.startKnown) leftOut++
        continue
      }
      const ps = p.start.getTime()
      const pe = p.end ? p.end.getTime() : t
      const lo = Math.max(f, ps)
      const hi = Math.min(t, pe)
      if (hi <= lo) continue
      const kind = isFirst ? first : relisted
      kind.ms += hi - lo
      kind.resellers.add(l.affiliateId)
      for (const b of LIFECYCLE_AGE_BANDS) {
        const bl = Math.max(lo, ps + b.lo * DAY)
        const bh = Math.min(hi, b.hi === Infinity ? hi : ps + b.hi * DAY)
        if (bh > bl) {
          const a = age.get(b.band)!
          a.ms += bh - bl
          a.resellers.add(l.affiliateId)
        }
      }
      for (const ts of sales) {
        const id = `${k}\u0000${ts}`
        if (ts < lo || ts >= hi || claimed.has(id)) continue
        claimed.add(id)
        kind.orders++
        const d = (ts - ps) / DAY
        const b = LIFECYCLE_AGE_BANDS.find((x) => d >= x.lo && d < x.hi)!
        age.get(b.band)!.orders++
      }
    }
  }
  const cell = (a: Acc, ref: Acc | null): LifecycleCell => {
    const listedDays = a.ms / DAY
    const ok = listedDays >= LIFECYCLE_MIN_LISTED_DAYS && a.resellers.size >= LIFECYCLE_MIN_RESELLERS && a.orders >= LIFECYCLE_MIN_ORDERS
    const base = { listedDays: round1(listedDays), orders: a.orders, resellers: a.resellers.size, ratePer100: ok ? Math.round((100 * a.orders / listedDays) * 1000) / 1000 : null }
    if (!ref) return { ...base, ratioVsReference: null, lo: null, hi: null, reading: ok ? "reference" : "insuffisant" }
    const refDays = ref.ms / DAY
    const refOk = refDays >= LIFECYCLE_MIN_LISTED_DAYS && ref.resellers.size >= LIFECYCLE_MIN_RESELLERS && ref.orders >= LIFECYCLE_MIN_ORDERS
    if (!ok || !refOk) return { ...base, ratioVsReference: null, lo: null, hi: null, reading: "insuffisant" }
    const lr = Math.log((a.orders + 0.5) / listedDays) - Math.log((ref.orders + 0.5) / refDays)
    const se = Math.sqrt(1 / (a.orders + 0.5) + 1 / (ref.orders + 0.5))
    const lo = Math.exp(lr - 1.96 * se)
    const hi = Math.exp(lr + 1.96 * se)
    return { ...base, ratioVsReference: Math.round(Math.exp(lr) * 1000) / 1000, lo: Math.round(lo * 1000) / 1000, hi: Math.round(hi * 1000) / 1000, reading: lo > 1 ? "plus_haut" : hi < 1 ? "plus_bas" : "non_concluant" }
  }
  const ref = age.get("0-14")!
  return {
    byAge: {
      "0-14": cell(ref, null),
      "14-45": cell(age.get("14-45")!, ref),
      "45+": cell(age.get("45+")!, ref),
    },
    firstPeriod: cell(first, null),
    relisted: cell(relisted, first),
    periodsLeftOut: leftOut,
    nature: "association_observee",
    limits: LIFECYCLE_LIMITS,
  }
}

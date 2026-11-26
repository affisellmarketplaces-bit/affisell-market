/**
 * AFFISELL INTELLIGENCE — Wikipedia page views as a candidate EXTERNAL DEMAND indicator, UNDER EVALUATION.
 *
 * Source: the Wikimedia Analytics REST API (public, free, no key; a descriptive User-Agent is required by Wikimedia's
 * policy). Daily views of one article, "user" agents only (bots excluded).
 *
 * Status: this source is NOT connected to the cockpit and produces NO signal. Attention on Wikipedia is popularity, not
 * demand, and certainly not demand on Affisell. It is kept only if the evaluation below shows, on Affisell's OWN sales,
 * that it ANNOUNCES them (a lead of ≥ 1 week), and only for the categories where it does.
 *
 * Evaluation (`evaluateLeadingIndicator`, pure, deterministic):
 *  - weekly series (ISO weeks), week-over-week change of log(1 + x) for views and for paid orders — levels are not
 *    compared (two trending series always "correlate");
 *  - Spearman correlation between views at week t − L and orders at week t, for L = 0…MAX_LAG;
 *  - p-value by permutation of the views changes (PERMUTATIONS, seeded PRNG: same data → same answer), Bonferroni over
 *    the lags tested;
 *  - verdicts: `insufficient` (< MIN_WEEKS aligned weeks or < MIN_ORDERS orders), `predictive` (a lag ≥ 1 with
 *    ρ ≥ MIN_RHO and p ≤ 5 % / lags), `concurrent_only` (only lag 0 passes: it moves WITH sales, too late to act),
 *    `not_shown` (nothing passes — "not shown", never "no link": absence of evidence on a short series).
 * A `predictive` verdict is a correlation in the past, not a guarantee; it must be re-checked on later data.
 */
export const WIKIMEDIA_PROJECTS = ["fr.wikipedia", "en.wikipedia", "de.wikipedia", "es.wikipedia", "it.wikipedia"] as const
export type WikimediaProject = (typeof WIKIMEDIA_PROJECTS)[number]
export const WIKIMEDIA_USER_AGENT = "AffisellIntelligence/1.0 (https://affisell.com; demand-indicator evaluation)"

export const MIN_WEEKS = 26
export const MIN_ORDERS = 30
export const MAX_LAG = 4
export const MIN_RHO = 0.3
export const PERMUTATIONS = 2000

const yyyymmdd = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("wikipedia_bad_date")
  return d.replace(/-/g, "")
}

/** Fixed host; the title is percent-encoded (a "/" in a title must become %2F); the project is whitelisted. */
export function pageviewsUrl(project: string, title: string, from: string, to: string): string {
  if (!(WIKIMEDIA_PROJECTS as readonly string[]).includes(project)) throw new Error("wikipedia_bad_project")
  const t = title.trim().replace(/ /g, "_")
  if (!t || t.length > 255) throw new Error("wikipedia_bad_title")
  return `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${project}/all-access/user/${encodeURIComponent(t)}/daily/${yyyymmdd(from)}/${yyyymmdd(to)}`
}

export type DailyViews = { date: string; views: number }

export function parsePageviews(json: unknown): DailyViews[] {
  const items = (json as { items?: unknown })?.items
  if (!Array.isArray(items)) throw new Error("wikipedia_unparseable")
  const out: DailyViews[] = []
  for (const it of items) {
    const ts = (it as { timestamp?: unknown }).timestamp
    const views = (it as { views?: unknown }).views
    if (typeof ts !== "string" || !/^\d{8}/.test(ts) || typeof views !== "number" || !Number.isFinite(views) || views < 0) continue
    out.push({ date: `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`, views })
  }
  return out
}

/** Downloads one article's daily views. `fetchImpl` is injected so scripts and tests choose the transport. */
export async function fetchPageviewsDaily(
  fetchImpl: typeof fetch,
  project: string,
  title: string,
  from: string,
  to: string
): Promise<DailyViews[]> {
  const res = await fetchImpl(pageviewsUrl(project, title, from, to), {
    signal: AbortSignal.timeout(10_000),
    headers: { accept: "application/json", "user-agent": WIKIMEDIA_USER_AGENT },
  })
  if (res.status === 404) return [] // article unknown or no views in the range
  if (!res.ok) throw new Error(`wikipedia_http_${res.status}`)
  const text = await res.text()
  if (text.length > 2_000_000) throw new Error("wikipedia_too_large")
  return parsePageviews(JSON.parse(text))
}

/** ISO week key (YYYY-Www) of a YYYY-MM-DD date. */
export function isoWeekOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

export function weeklyTotals(days: Array<{ date: string; value: number }>): Map<string, number> {
  const out = new Map<string, number>()
  for (const d of days) out.set(isoWeekOf(d.date), (out.get(isoWeekOf(d.date)) ?? 0) + d.value)
  return out
}

// ---- statistics ----------------------------------------------------------------------------------------------------

function ranks(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
  const r = new Array<number>(xs.length)
  for (let i = 0; i < idx.length; ) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) r[idx[k]![1]] = avg
    i = j + 1
  }
  return r
}

export function spearman(x: number[], y: number[]): number {
  const n = x.length
  if (n < 3 || y.length !== n) return 0
  const rx = ranks(x)
  const ry = ranks(y)
  const mx = rx.reduce((a, b) => a + b, 0) / n
  const my = ry.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my)
    dx += (rx[i]! - mx) ** 2
    dy += (ry[i]! - my) ** 2
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0
}

/** Deterministic PRNG (mulberry32): the evaluation gives the same answer on the same data. */
function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const diffLog = (xs: number[]) => xs.slice(1).map((v, i) => Math.log1p(v) - Math.log1p(xs[i]!))

export type LagResult = { lag: number; rho: number; pValue: number; n: number }
export type IndicatorVerdict = "insufficient" | "predictive" | "concurrent_only" | "not_shown"
export type IndicatorEvaluation = { verdict: IndicatorVerdict; weeks: number; orders: number; lags: LagResult[]; best: LagResult | null; threshold: number; reason: string }

export function evaluateLeadingIndicator(views: Map<string, number>, orders: Map<string, number>, weeks: string[]): IndicatorEvaluation {
  const v = weeks.map((w) => views.get(w) ?? 0)
  const o = weeks.map((w) => orders.get(w) ?? 0)
  const totalOrders = o.reduce((a, b) => a + b, 0)
  const threshold = 0.05 / (MAX_LAG + 1)
  if (weeks.length < MIN_WEEKS || totalOrders < MIN_ORDERS) {
    return {
      verdict: "insufficient",
      weeks: weeks.length,
      orders: totalOrders,
      lags: [],
      best: null,
      threshold,
      reason: `Données insuffisantes : ${weeks.length} semaine(s) (minimum ${MIN_WEEKS}) et ${totalOrders} commande(s) (minimum ${MIN_ORDERS}).`,
    }
  }
  const dv = diffLog(v)
  const dor = diffLog(o)
  const lags: LagResult[] = []
  for (let lag = 0; lag <= MAX_LAG; lag++) {
    const x = dv.slice(0, dv.length - lag)
    const y = dor.slice(lag)
    const rho = spearman(x, y)
    const rnd = prng(0xa11 + lag)
    let atLeast = 0
    const xp = [...x]
    for (let k = 0; k < PERMUTATIONS; k++) {
      for (let i = xp.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1))
        ;[xp[i], xp[j]] = [xp[j]!, xp[i]!]
      }
      if (spearman(xp, y) >= rho) atLeast++
    }
    lags.push({ lag, rho, pValue: (atLeast + 1) / (PERMUTATIONS + 1), n: x.length })
  }
  const passing = lags.filter((l) => l.rho >= MIN_RHO && l.pValue <= threshold)
  const leading = passing.filter((l) => l.lag >= 1).sort((a, b) => a.pValue - b.pValue || b.rho - a.rho)
  const best = leading[0] ?? passing[0] ?? [...lags].sort((a, b) => a.pValue - b.pValue)[0] ?? null
  const fmt = (l: LagResult) => `décalage ${l.lag} sem., ρ = ${l.rho.toFixed(2).replace(".", ",")}, p = ${l.pValue.toFixed(4).replace(".", ",")}`
  if (leading.length > 0) {
    return { verdict: "predictive", weeks: weeks.length, orders: totalOrders, lags, best, threshold, reason: `Les vues précèdent les commandes (${fmt(leading[0]!)}) — corrélation passée, à revérifier sur de nouvelles données.` }
  }
  if (passing.length > 0) {
    return { verdict: "concurrent_only", weeks: weeks.length, orders: totalOrders, lags, best, threshold, reason: `Les vues bougent en même temps que les commandes (${fmt(passing[0]!)}), sans avance : trop tard pour agir.` }
  }
  return { verdict: "not_shown", weeks: weeks.length, orders: totalOrders, lags, best, threshold, reason: `Aucun lien démontré (meilleur : ${best ? fmt(best) : "—"}, seuil p ≤ ${threshold.toFixed(3).replace(".", ",")}).` }
}

/** Consecutive ISO weeks covering [from, to] (dates YYYY-MM-DD), in order. */
export function weeksBetween(from: string, to: string): string[] {
  const out: string[] = []
  const d = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (d <= end) {
    const w = isoWeekOf(d.toISOString().slice(0, 10))
    if (out[out.length - 1] !== w) out.push(w)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

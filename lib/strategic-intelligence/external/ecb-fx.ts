import type { StrategicSignal } from "@/lib/strategic-intelligence/types"

/**
 * First EXTERNAL watch of Affisell Intelligence: the euro reference exchange rates published by the European Central
 * Bank (pure part: parsing + detection).
 *
 * WHY THIS SOURCE FIRST
 *  - Official, free, no key, no account, published every working day around 16:00 CET; one small XML file covers the
 *    last 90 days (https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml). The ECB states the rates are for
 *    information purposes — exactly our use (detection, never a transaction).
 *  - What is VERIFIED in the code: AliExpress costs are stored in EUR once, at import / enlist time
 *    (SupplierLink.aePriceCents, parsed by lib/aliexpress-price-eur.ts, which refuses a price explicitly in another
 *    currency); nothing refreshes them on a schedule (the "aliexpress-refresh" cron renews the API TOKEN, not prices);
 *    the auto-buy margin floor reasons on that stored cost.
 *  - What is a HYPOTHESIS (and labelled so on the screen): that AliExpress's euro price follows the exchange rate,
 *    i.e. that the sellers fix their prices in USD / CNY. Affisell pays AliExpress in EUR; if the seller's price is in
 *    USD, a weaker euro raises the euro price at the next order. The signal therefore says "re-check the stored costs",
 *    never "your costs rose by X".
 *
 * FREQUENCY / COST: one request per cockpit build, cached 6 h by the fetch cache (≤ 4 requests a day), 0 €.
 *
 * TRUST RULES
 *  - Compares the latest published rate with the rate published closest to (and not after) 30 days earlier.
 *  - A move of ≥ 3 % over those 30 days raises a signal. 3 % is a deliberate starting threshold (the euro rarely moves
 *    that much in a month against the dollar); it is a parameter to calibrate with the decision journal, not a law.
 *  - Data older than 4 calendar days (a long weekend + one holiday) is "stale": the signal is kept but confidence drops
 *    to low and says so.
 */
export const ECB_HIST_90D_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml"
export const FX_MOVE_THRESHOLD_BPS = 300
export const FX_COMPARE_DAYS = 30
export const FX_STALE_DAYS = 4
export const WATCHED_CURRENCIES = ["USD", "CNY"] as const

export type FxDay = { date: string; rates: Record<string, number> }

/** Parses the ECB XML (Cube time= … / Cube currency= rate=). Newest first. Ignores anything malformed. */
export function parseEcbHistXml(xml: string): FxDay[] {
  const days: FxDay[] = []
  const dayRe = /<Cube\s+time=["'](\d{4}-\d{2}-\d{2})["']\s*>([\s\S]*?)<\/Cube>/g
  const rateRe = /<Cube\s+currency=["']([A-Z]{3})["']\s+rate=["']([0-9]+(?:\.[0-9]+)?)["']\s*\/>/g
  for (const m of xml.matchAll(dayRe)) {
    const rates: Record<string, number> = {}
    for (const r of m[2]!.matchAll(rateRe)) {
      const v = Number(r[2])
      if (Number.isFinite(v) && v > 0) rates[r[1]!] = v
    }
    if (Object.keys(rates).length > 0) days.push({ date: m[1]!, rates })
  }
  return days.sort((a, b) => b.date.localeCompare(a.date))
}

export type FxMove = { currency: string; latestDate: string; latest: number; baseDate: string; base: number; euroChangeBps: number }

export function fxMoves(days: FxDay[], currencies: readonly string[] = WATCHED_CURRENCIES): FxMove[] {
  if (days.length === 0) return []
  const latest = days[0]!
  const target = new Date(`${latest.date}T00:00:00Z`).getTime() - FX_COMPARE_DAYS * 86_400_000
  const base = days.find((d) => new Date(`${d.date}T00:00:00Z`).getTime() <= target)
  if (!base) return []
  const out: FxMove[] = []
  for (const c of currencies) {
    const l = latest.rates[c]
    const b = base.rates[c]
    if (!l || !b) continue
    // Rates are "1 EUR = x <currency>": a lower x means a weaker euro.
    out.push({ currency: c, latestDate: latest.date, latest: l, baseDate: base.date, base: b, euroChangeBps: Math.round(((l - b) / b) * 10_000) })
  }
  return out
}

const pct = (bps: number) => `${bps > 0 ? "+" : ""}${(bps / 100).toFixed(1).replace(".", ",")} %`

export type FxExposure = {
  activeAeLinks: number
  autoBuyLinks: number
  /** Active links whose stored cost was last written BEFORE the comparison base date (i.e. at an older rate). */
  staleSinceBase: number
}

export function fxSignals(moves: FxMove[], ctx: { observedAt: string; exposure: FxExposure }): StrategicSignal[] {
  const out: StrategicSignal[] = []
  for (const m of moves) {
    if (Math.abs(m.euroChangeBps) < FX_MOVE_THRESHOLD_BPS) continue
    const weaker = m.euroChangeBps < 0
    const ageDays = (new Date(ctx.observedAt).getTime() - new Date(`${m.latestDate}T16:00:00Z`).getTime()) / 86_400_000
    const stale = ageDays > FX_STALE_DAYS
    // Cost of something priced in that currency, expressed in EUR: 1/rate → change ≈ −Δrate/rate.
    const costBps = Math.round((m.base / m.latest - 1) * 10_000)
    const exposed = ctx.exposure.staleSinceBase
    out.push({
      id: `supplier:fx:${m.currency}:${weaker ? "weaker" : "stronger"}:${m.latestDate}`,
      domain: "supplier",
      // The rate move is a fact; what it ALERTS about (euro costs at AliExpress) is a hypothesis → labelled so.
      priority: weaker && exposed > 0 ? "important" : "study",
      kind: "hypothesis",
      title: weaker
        ? `L'euro a perdu ${pct(m.euroChangeBps).replace("-", "")} face au ${m.currency} en 30 jours (BCE)`
        : `L'euro a gagné ${pct(m.euroChangeBps)} face au ${m.currency} en 30 jours (BCE)`,
      evidence: [
        { label: `1 EUR = … ${m.currency} au ${m.latestDate}`, value: String(m.latest) },
        { label: `1 EUR = … ${m.currency} au ${m.baseDate}`, value: String(m.base) },
        { label: "Liens AliExpress actifs (coût stocké en EUR)", value: String(ctx.exposure.activeAeLinks) },
        { label: `Dont coût non mis à jour depuis le ${m.baseDate}`, value: String(exposed) },
        { label: "Liens en achat automatique", value: String(ctx.exposure.autoBuyLinks) },
        {
          label: `Hypothèse — effet sur un prix fixé en ${m.currency}`,
          value: `${pct(costBps)} en euros`,
        },
      ],
      source: { id: "ecb.eurofxref", query: `${ECB_HIST_90D_URL} — ${m.currency}, ${m.baseDate} → ${m.latestDate}` },
      observedAt: ctx.observedAt,
      window: { from: `${m.baseDate}T00:00:00.000Z`, to: `${m.latestDate}T00:00:00.000Z` },
      confidence: stale ? "low" : "high",
      confidenceReason: stale
        ? `Dernier taux publié il y a ${Math.floor(ageDays)} jours : donnée périmée, à revérifier.`
        : `Le mouvement de change est un fait (taux de référence officiels de la BCE). Son effet sur vos coûts est une hypothèse : il suppose que les vendeurs AliExpress fixent leurs prix en ${m.currency}.`,
      recommendedAction: weaker
        ? `Revérifier sur AliExpress le prix actuel en euros des produits les plus vendus parmi les ${exposed} lien(s) au coût ancien, et mettre à jour le coût stocké avant tout achat automatique.`
        : "Revérifier les coûts stockés : s'ils ont baissé en euros, une baisse de prix ciblée sur les produits importés les plus vendus devient possible.",
      link: "/admin/auto-fulfill",
    })
  }
  return out
}

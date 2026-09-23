import "server-only"

/**
 * CNY → EUR conversion for supplier imports whose source (currently: 1688 via OneBound)
 * returns prices in Chinese yuan. Everything downstream of an import (wholesale price
 * suggestion, stored cost price) is treated as EUR with no further conversion — so this
 * must run before a CNY price is ever assigned to a numeric `price`/`cost` field.
 *
 * Live rate from Frankfurter (ECB-sourced, free, no API key: https://frankfurter.dev),
 * cached in-memory for a while so a burst of 1688 imports doesn't hit it per request.
 * Falls back to a hardcoded approximate rate if the live fetch fails or times out — an
 * import must never hang or fail just because a free FX API had a bad moment, and a
 * roughly-right wholesale price beats no price at all for what's just supplier-facing
 * guidance (the supplier still sets their own final wholesale price afterwards).
 */

const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base=CNY&symbols=EUR"
const RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6h — FX doesn't need per-request freshness here
const FETCH_TIMEOUT_MS = 5_000

/** Approximate CNY→EUR — only used if the live rate can't be fetched. Update if it drifts far. */
const FALLBACK_CNY_EUR_RATE = 0.13

let cachedRate: { rate: number; fetchedAt: number } | null = null

async function fetchLiveCnyEurRate(): Promise<number | null> {
  try {
    const res = await fetch(FRANKFURTER_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    const data = (await res.json()) as { rates?: { EUR?: number } }
    const rate = data.rates?.EUR
    return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null
  } catch {
    return null
  }
}

/** CNY→EUR rate, live when available (cached 6h), falling back to an approximate constant. */
export async function getCnyToEurRate(): Promise<{ rate: number; source: "live" | "fallback" }> {
  const now = Date.now()
  if (cachedRate && now - cachedRate.fetchedAt < RATE_CACHE_TTL_MS) {
    return { rate: cachedRate.rate, source: "live" }
  }
  const live = await fetchLiveCnyEurRate()
  if (live) {
    cachedRate = { rate: live, fetchedAt: now }
    return { rate: live, source: "live" }
  }
  return { rate: FALLBACK_CNY_EUR_RATE, source: "fallback" }
}

/** Converts a CNY amount to EUR, rounded to cents. */
export async function convertCnyToEur(amountCny: number): Promise<number> {
  if (!Number.isFinite(amountCny) || amountCny <= 0) return 0
  const { rate } = await getCnyToEurRate()
  return Math.round(amountCny * rate * 100) / 100
}

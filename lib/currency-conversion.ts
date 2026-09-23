import "server-only"

/**
 * Currency conversion for supplier imports whose source returns prices in something other
 * than EUR (1688 → CNY, CJ Dropshipping → USD — CJ's API is USD-only, confirmed against
 * their own docs: https://developers.cjdropshipping.cn/en/api/api2/standard/field.html).
 * Everything downstream of an import (wholesale price suggestion, stored cost price) is
 * treated as EUR with no further conversion — so this must run before a non-EUR price is
 * ever assigned to a numeric `price`/`cost` field. (A 1688 import once skipped this and
 * stored ¥100 as if it were €100 — see the CNY fix commit.)
 *
 * Live rate from Frankfurter (ECB-sourced, free, no API key: https://frankfurter.dev),
 * cached in-memory per source currency for a while so a burst of imports doesn't hit it
 * per request. Falls back to a hardcoded approximate rate if the live fetch fails or times
 * out — an import must never hang or fail just because a free FX API had a bad moment, and
 * a roughly-right wholesale price beats no price at all for what's just supplier-facing
 * guidance (the supplier still sets their own final wholesale price afterwards).
 */

const RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6h — FX doesn't need per-request freshness here
const FETCH_TIMEOUT_MS = 5_000

type SourceCurrency = "CNY" | "USD"

/** Approximate rates — only used if the live rate can't be fetched. Update if they drift far. */
const FALLBACK_RATES: Record<SourceCurrency, number> = {
  CNY: 0.13,
  USD: 0.92,
}

const rateCache = new Map<SourceCurrency, { rate: number; fetchedAt: number }>()

async function fetchLiveRate(from: SourceCurrency): Promise<number | null> {
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=EUR`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { rates?: { EUR?: number } }
    const rate = data.rates?.EUR
    return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null
  } catch {
    return null
  }
}

/** `from`→EUR rate, live when available (cached 6h per currency), falling back to an approximate constant. */
export async function getRateToEur(
  from: SourceCurrency
): Promise<{ rate: number; source: "live" | "fallback" }> {
  const now = Date.now()
  const cached = rateCache.get(from)
  if (cached && now - cached.fetchedAt < RATE_CACHE_TTL_MS) {
    return { rate: cached.rate, source: "live" }
  }
  const live = await fetchLiveRate(from)
  if (live) {
    rateCache.set(from, { rate: live, fetchedAt: now })
    return { rate: live, source: "live" }
  }
  return { rate: FALLBACK_RATES[from], source: "fallback" }
}

/** Converts an amount in `from` currency to EUR, rounded to cents. */
export async function convertToEur(amount: number, from: SourceCurrency): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const { rate } = await getRateToEur(from)
  return Math.round(amount * rate * 100) / 100
}

/** CNY→EUR rate, live when available (cached 6h), falling back to an approximate constant. */
export async function getCnyToEurRate(): Promise<{ rate: number; source: "live" | "fallback" }> {
  return getRateToEur("CNY")
}

/** Converts a CNY amount to EUR, rounded to cents. */
export async function convertCnyToEur(amountCny: number): Promise<number> {
  return convertToEur(amountCny, "CNY")
}

/** USD→EUR rate, live when available (cached 6h), falling back to an approximate constant. */
export async function getUsdToEurRate(): Promise<{ rate: number; source: "live" | "fallback" }> {
  return getRateToEur("USD")
}

/** Converts a USD amount to EUR, rounded to cents. */
export async function convertUsdToEur(amountUsd: number): Promise<number> {
  return convertToEur(amountUsd, "USD")
}

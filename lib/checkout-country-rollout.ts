import { stripeCheckoutAllowedCountriesForRegion } from "@/lib/eu-market-countries"
import type { MarketRegion } from "@/lib/market-config"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

const CACHE_MS = 60_000

let rolloutCache: { at: number; countries: string[]; region: MarketRegion } | null = null

export function invalidateCheckoutRolloutCache(): void {
  rolloutCache = null
}

export function extractOrderShippingCountryIso2(shippingAddress: unknown): string | null {
  if (!shippingAddress || typeof shippingAddress !== "object") return null
  const country = (shippingAddress as { country?: unknown }).country
  return normalizeVisitorCountryIso2(typeof country === "string" ? country : "")
}

export function isRolloutOnlyCheckoutCountry(
  countryIso2: string,
  rollout: readonly string[],
  base: readonly string[]
): boolean {
  const code = countryIso2.toUpperCase()
  const baseSet = new Set(base.map((c) => c.toUpperCase()))
  return rollout.some((c) => c.toUpperCase() === code) && !baseSet.has(code)
}

export function mergeCheckoutAllowedCountries(
  base: readonly string[],
  rollout: readonly string[]
): string[] {
  return [...new Set([...base, ...rollout].map((c) => c.toUpperCase()))].sort()
}

export async function loadRolloutCheckoutCountryIso2(
  region: MarketRegion = MARKET_REGION
): Promise<string[]> {
  const now = Date.now()
  if (rolloutCache && rolloutCache.region === region && now - rolloutCache.at < CACHE_MS) {
    return rolloutCache.countries
  }

  const rows = await prisma.checkoutCountryRollout.findMany({
    where: { marketRegion: region, enabled: true },
    select: { countryIso2: true },
  })
  const countries = rows.map((row) => row.countryIso2.toUpperCase())
  rolloutCache = { at: now, countries, region }
  return countries
}

export async function resolveStripeCheckoutAllowedCountries(
  region: MarketRegion = MARKET_REGION
): Promise<string[]> {
  const base = stripeCheckoutAllowedCountriesForRegion(region)
  const rollout = await loadRolloutCheckoutCountryIso2(region)
  return mergeCheckoutAllowedCountries(base, rollout)
}

export async function isStripeCheckoutCountryResolved(
  code: string | null | undefined,
  region: MarketRegion = MARKET_REGION
): Promise<boolean> {
  const normalized = normalizeVisitorCountryIso2(code ?? "")
  if (!normalized) return false
  const allowed = await resolveStripeCheckoutAllowedCountries(region)
  return allowed.includes(normalized)
}

export async function isRolloutOnlyCheckoutCountryResolved(
  code: string | null | undefined,
  region: MarketRegion = MARKET_REGION
): Promise<boolean> {
  const normalized = normalizeVisitorCountryIso2(code ?? "")
  if (!normalized) return false
  const base = stripeCheckoutAllowedCountriesForRegion(region)
  const rollout = await loadRolloutCheckoutCountryIso2(region)
  return isRolloutOnlyCheckoutCountry(normalized, rollout, base)
}

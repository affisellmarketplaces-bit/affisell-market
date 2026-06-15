import { stripeCheckoutAllowedCountriesForRegion } from "@/lib/eu-market-countries"
import type { MarketRegion } from "@/lib/market-config"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

const CACHE_MS = 60_000

let rolloutCache: { at: number; countries: string[]; region: MarketRegion } | null = null
let pilotRolloutCache: { at: number; countries: string[]; region: MarketRegion } | null = null
let graduatedCache: { at: number; countries: string[]; region: MarketRegion } | null = null

export function invalidateCheckoutRolloutCache(): void {
  rolloutCache = null
  pilotRolloutCache = null
  graduatedCache = null
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

/** Static region list + graduated ROW countries (permanent checkout base). */
export function mergeEffectiveCheckoutBase(
  staticBase: readonly string[],
  graduated: readonly string[]
): string[] {
  return mergeCheckoutAllowedCountries(staticBase, graduated)
}

export async function loadGraduatedCheckoutCountryIso2(
  region: MarketRegion = MARKET_REGION
): Promise<string[]> {
  const now = Date.now()
  if (graduatedCache && graduatedCache.region === region && now - graduatedCache.at < CACHE_MS) {
    return graduatedCache.countries
  }

  const rows = await prisma.checkoutCountryRollout.findMany({
    where: { marketRegion: region, graduatedAt: { not: null } },
    select: { countryIso2: true },
    orderBy: { graduatedAt: "asc" },
  })
  const countries = rows.map((row) => row.countryIso2.toUpperCase())
  graduatedCache = { at: now, countries, region }
  return countries
}

export async function resolveEffectiveCheckoutBaseCountries(
  region: MarketRegion = MARKET_REGION
): Promise<string[]> {
  const staticBase = stripeCheckoutAllowedCountriesForRegion(region)
  const graduated = await loadGraduatedCheckoutCountryIso2(region)
  return mergeEffectiveCheckoutBase(staticBase, graduated)
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

/** Enabled rollouts still in pilot phase (not yet graduated to permanent checkout). */
export async function loadPilotRolloutCheckoutCountryIso2(
  region: MarketRegion = MARKET_REGION
): Promise<string[]> {
  const now = Date.now()
  if (pilotRolloutCache && pilotRolloutCache.region === region && now - pilotRolloutCache.at < CACHE_MS) {
    return pilotRolloutCache.countries
  }

  const rows = await prisma.checkoutCountryRollout.findMany({
    where: { marketRegion: region, enabled: true, graduatedAt: null },
    select: { countryIso2: true },
  })
  const countries = rows.map((row) => row.countryIso2.toUpperCase())
  pilotRolloutCache = { at: now, countries, region }
  return countries
}

export async function resolveStripeCheckoutAllowedCountries(
  region: MarketRegion = MARKET_REGION
): Promise<string[]> {
  const base = await resolveEffectiveCheckoutBaseCountries(region)
  const pilot = await loadPilotRolloutCheckoutCountryIso2(region)
  return mergeCheckoutAllowedCountries(base, pilot)
}

export async function resolveLiveCheckoutCountryCount(
  region: MarketRegion = MARKET_REGION
): Promise<number> {
  return (await resolveStripeCheckoutAllowedCountries(region)).length
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
  const base = await resolveEffectiveCheckoutBaseCountries(region)
  const rollout = await loadPilotRolloutCheckoutCountryIso2(region)
  return isRolloutOnlyCheckoutCountry(normalized, rollout, base)
}

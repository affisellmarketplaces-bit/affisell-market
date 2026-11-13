import "server-only"

import {
  buildHeuristicMarket,
  categorySlugFromTaxonomy,
  MARKET_FIXTURES_2026,
  normalizeProductKey,
  resolveFixtureKeyFromHints,
  snapshotFromFixture,
} from "@/lib/ai/market-intelligence-fixtures"
import {
  getCachedMarketData,
  setCachedMarketData,
} from "@/lib/ai/market-intelligence-cache"
import type { MarketDataSnapshot } from "@/lib/ai/smart-margin-types"

export type MarketDataHints = {
  title?: string
  categoryId?: string
  priceEur?: number
  productId?: string
}

export function resolveMarketProductKey(hints: MarketDataHints): string {
  if (hints.productId?.trim()) return normalizeProductKey(hints.productId)
  const fixture = resolveFixtureKeyFromHints(hints)
  if (fixture) return fixture
  const titleKey = hints.title?.trim() ? normalizeProductKey(hints.title) : ""
  if (titleKey) return titleKey.slice(0, 60)
  const cat = hints.categoryId?.trim() || "unknown"
  const price = hints.priceEur ? Math.round(hints.priceEur) : 0
  return normalizeProductKey(`${cat}-${price}`)
}

/** Pipeline entry — Redis cache → fixture → heuristic (no external API required for v1). */
export async function getMarketData(
  productKey: string,
  hints: MarketDataHints = {}
): Promise<MarketDataSnapshot> {
  const key = normalizeProductKey(productKey) || "unknown-product"
  const cached = await getCachedMarketData(key)
  if (cached) {
    // `source` says "cache"; `origin` keeps saying what the numbers are (an entry cached before `origin` existed, or relabelled
    // "live" by the old cron, was a fixture or a heuristic — never live data).
    const legacySource = cached.source as string
    const origin = cached.origin ?? (legacySource === "heuristic" ? "heuristic" : "fixture")
    return { ...cached, source: "cache", origin }
  }

  const fixtureSlug = resolveFixtureKeyFromHints(hints) ?? (MARKET_FIXTURES_2026[key] ? key : null)
  if (fixtureSlug && MARKET_FIXTURES_2026[fixtureSlug]) {
    const snapshot = snapshotFromFixture(fixtureSlug, MARKET_FIXTURES_2026[fixtureSlug]!)
    await setCachedMarketData(key, snapshot)
    return snapshot
  }

  const category = categorySlugFromTaxonomy(hints.categoryId)
  const heuristic = buildHeuristicMarket({
    productKey: key,
    category,
    priceEur: hints.priceEur,
  })
  await setCachedMarketData(key, heuristic)
  return heuristic
}

/**
 * Cron batch — re-writes the 3 hand-written demo fixtures into the cache so their TTL does not lapse. NOTHING is fetched from
 * any market source: the snapshots keep `source: "fixture"` / `origin: "fixture"` (they used to be relabelled "live", and the
 * comment called this a "6h scraper sync" — there is no scraper).
 */
export async function syncMarketIntelligenceFixtures(): Promise<{
  synced: number
  keys: string[]
  origin: "fixture"
  live: false
}> {
  const keys: string[] = []
  for (const [fixtureKey, fixture] of Object.entries(MARKET_FIXTURES_2026)) {
    const snapshot = snapshotFromFixture(fixtureKey, fixture)
    await setCachedMarketData(fixtureKey, snapshot)
    keys.push(fixtureKey)
  }
  console.log("[market-intelligence]", { result: "cron_ttl_refresh_fixtures", synced: keys.length, keys, live: false })
  return { synced: keys.length, keys, origin: "fixture", live: false }
}

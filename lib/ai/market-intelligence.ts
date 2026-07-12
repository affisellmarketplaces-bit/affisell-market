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
    return { ...cached, source: "cache" }
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

/** Cron batch — refresh fixture snapshots into Redis (simulates 6h scraper sync). */
export async function syncMarketIntelligenceFixtures(): Promise<{ synced: number; keys: string[] }> {
  const keys: string[] = []
  for (const [fixtureKey, fixture] of Object.entries(MARKET_FIXTURES_2026)) {
    const snapshot = snapshotFromFixture(fixtureKey, fixture)
    snapshot.source = "live"
    await setCachedMarketData(fixtureKey, snapshot)
    keys.push(fixtureKey)
  }
  console.log("[market-intelligence]", { result: "cron_sync", synced: keys.length, keys })
  return { synced: keys.length, keys }
}

import type { MarketCategorySlug, MarketDataSnapshot } from "@/lib/ai/smart-margin-types"

/** Curated 2026 market snapshots — cron refreshes TTL, fixtures are fallback baseline. */
export const MARKET_FIXTURES_2026: Record<string, Omit<MarketDataSnapshot, "productKey" | "fetchedAt" | "source">> = {
  "iphone-17-pro": {
    category: "hightech",
    avgPriceEur: 999,
    competition: 23,
    trendScore: 88,
    trendSlope90d: 12,
    hashtagVelocity: 74,
    dataQuality: 0.94,
    seasonalityPeakDays: 45,
    supplierLeadTimeHours: 48,
  },
  "jbl-tune-flex": {
    category: "audio",
    avgPriceEur: 79,
    competition: 6,
    trendScore: 91,
    trendSlope90d: 32,
    hashtagVelocity: 82,
    dataQuality: 0.94,
    seasonalityPeakDays: null,
    supplierLeadTimeHours: 36,
  },
  "airpods-pro-3": {
    category: "audio",
    avgPriceEur: 279,
    competition: 14,
    trendScore: 85,
    trendSlope90d: 18,
    hashtagVelocity: 70,
    dataQuality: 0.9,
    seasonalityPeakDays: 60,
    supplierLeadTimeHours: 48,
  },
}

export function normalizeProductKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}

export function resolveFixtureKeyFromHints(hints: {
  title?: string
  categoryId?: string
}): string | null {
  const title = hints.title?.trim().toLowerCase() ?? ""
  if (/iphone\s*17|iphone17/.test(title)) return "iphone-17-pro"
  if (/jbl|tune flex/.test(title)) return "jbl-tune-flex"
  if (/airpods pro 3|airpods pro3/.test(title)) return "airpods-pro-3"
  return null
}

export function categorySlugFromTaxonomy(categoryId: string | undefined): MarketCategorySlug {
  const id = categoryId?.trim().toLowerCase() ?? ""
  if (/phone|smartphone|tablet|ordi|laptop|tech|electronique|high-tech/.test(id)) return "hightech"
  if (/beaut|cosmet|parfum|soin/.test(id)) return "beaute"
  if (/mode|vetement|chauss|fashion/.test(id)) return "mode"
  if (/audio|casque|ecouteur|enceinte|jbl|son/.test(id)) return "audio"
  if (/maison|meuble|deco|cuisine|jardin/.test(id)) return "maison"
  return "other"
}

export function buildHeuristicMarket(args: {
  productKey: string
  category: MarketCategorySlug
  priceEur?: number
}): MarketDataSnapshot {
  const basePrice = args.priceEur && args.priceEur > 0 ? args.priceEur : 49.99
  return {
    productKey: args.productKey,
    category: args.category,
    avgPriceEur: basePrice,
    competition: 12,
    trendScore: 55,
    trendSlope90d: 5,
    hashtagVelocity: 40,
    dataQuality: 0.3,
    seasonalityPeakDays: null,
    supplierLeadTimeHours: 72,
    fetchedAt: new Date().toISOString(),
    source: "heuristic",
  }
}

export function snapshotFromFixture(
  productKey: string,
  fixture: (typeof MARKET_FIXTURES_2026)[string]
): MarketDataSnapshot {
  return {
    productKey,
    ...fixture,
    fetchedAt: new Date().toISOString(),
    source: "fixture",
  }
}

import "server-only"

import { isSerperConfigured } from "@/lib/radar/crawler/serper-client"
import { getTrendingKeywords } from "@/lib/radar/google/trends-watcher"
import type { TrendingKeyword } from "@/lib/radar/crawler/types"
import { trendingKeywordsFrFallback } from "@/lib/radar/trending-seeds-fr"

function serpApiConfigured(): boolean {
  return Boolean(
    process.env.SERPAPI_API_KEY?.trim() || process.env.SERPAPI_KEY?.trim()
  )
}

/** Live trends when keys exist; curated FR fallback otherwise — never surfaces env errors. */
export async function loadRadarTrendingKeywordsForDashboard(
  seeds: string[]
): Promise<{ trends: TrendingKeyword[]; source: "live" | "affisell_fr" }> {
  if (isSerperConfigured() || serpApiConfigured()) {
    const live = await getTrendingKeywords(seeds).catch(() => [])
    const hot = live.filter((t) => t.growth > 50)
    if (hot.length > 0) {
      return { trends: hot, source: "live" }
    }
  }
  return { trends: trendingKeywordsFrFallback(seeds), source: "affisell_fr" }
}

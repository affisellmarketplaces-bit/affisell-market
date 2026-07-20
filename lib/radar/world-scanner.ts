import "server-only"

import { loadAffisellFrRadarWinners } from "@/lib/radar/affisell-fr-catalog.server"
import { isSerperConfigured } from "@/lib/radar/crawler/serper-client"
import { getTrendingKeywords } from "@/lib/radar/google/trends-watcher"
import {
  buildMockTrendingForCountry,
  buildMockWinnersForCountry,
} from "@/lib/radar/world-mock-catalog"
import { getWorldCountry } from "@/lib/radar/world-countries"
import { WORLD_RADAR_CACHE_TTL_MS } from "@/lib/radar/world-radar-types"

export type ScannedWinner = {
  countryCode: string
  rank: number
  title: string
  image: string | null
  source: string
  price: number | null
  currency: string
  growthRate: number | null
  searches: number | null
  competition: number | null
  trendingScore: number
  category: string | null
  productId?: string
  isNew?: boolean
  isHot?: boolean
  isLocalWinner?: boolean
  lastWeekRank?: number | null
  finalScore?: number
  supplierLabel?: string
}

export type ScannedTrending = {
  countryCode: string
  keyword: string
  growthRate: number
  volume: number | null
}

export interface RadarProvider {
  scan(country: string): Promise<ScannedWinner[]>
}

/** Affisell Stock FR catalog — real marketplace listings for France. */
export class AffisellProvider implements RadarProvider {
  async scan(country: string): Promise<ScannedWinner[]> {
    if (country.toUpperCase() !== "FR") return []
    const rows = await loadAffisellFrRadarWinners({ limit: 20 })
    return rows.map((row, index) => ({
      countryCode: "FR",
      rank: row.rank ?? index + 1,
      title: row.title,
      image: row.imageUrl,
      source: "Affisell",
      price: row.price > 0 ? row.price : null,
      currency: row.currency || "EUR",
      growthRate: row.salesEst ? Math.min(150, 40 + row.salesEst * 2) : 55,
      searches: row.salesEst ? row.salesEst * 120 : 8000,
      competition: 3,
      trendingScore: Math.min(100, 70 + (row.salesEst ?? 0)),
      category: null,
    }))
  }
}

/** Intelligent mock — localized bestsellers with jitter for daily-refresh feel. */
export class MockIntelligentProvider implements RadarProvider {
  async scan(country: string): Promise<ScannedWinner[]> {
    return buildMockWinnersForCountry(country.toUpperCase(), 20)
  }
}

/** Serper when configured — falls back to mock on empty/error. */
export class SerperProvider implements RadarProvider {
  private fallback = new MockIntelligentProvider()

  async scan(country: string): Promise<ScannedWinner[]> {
    if (!isSerperConfigured()) {
      return this.fallback.scan(country)
    }
    try {
      const seeds = ["best seller product", "trending gadget", "viral product"]
      const trends = await getTrendingKeywords(seeds)
      if (trends.length === 0) return this.fallback.scan(country)
      const countryDef = getWorldCountry(country)
      const currency = countryDef?.currency ?? "USD"
      return trends.slice(0, 20).map((t, index) => ({
        countryCode: country.toUpperCase(),
        rank: index + 1,
        title: t.keyword,
        image: null,
        source: "Google",
        price: null,
        currency,
        growthRate: t.growth,
        searches: t.volume,
        competition: 8,
        trendingScore: Math.min(100, t.growth),
        category: null,
      }))
    } catch (err) {
      console.warn("[world-scanner]", {
        provider: "serper",
        country,
        result: "fallback_mock",
        message: err instanceof Error ? err.message : "unknown",
      })
      return this.fallback.scan(country)
    }
  }
}

export async function scanCountryWinners(countryCode: string): Promise<ScannedWinner[]> {
  const code = countryCode.toUpperCase()
  const affisell = new AffisellProvider()
  if (code === "FR") {
    const live = await affisell.scan(code)
    if (live.length >= 5) return live
  }

  const serper = new SerperProvider()
  const winners = await serper.scan(code)
  if (code === "FR" && winners.length < 5) {
    const frLive = await affisell.scan(code)
    if (frLive.length > 0) return frLive
  }
  return winners
}

export async function scanCountryTrending(countryCode: string): Promise<ScannedTrending[]> {
  const code = countryCode.toUpperCase()
  if (isSerperConfigured()) {
    try {
      const live = await getTrendingKeywords(["trending product", "best seller"])
      if (live.length > 0) {
        return live.slice(0, 5).map((t) => ({
          countryCode: code,
          keyword: t.keyword,
          growthRate: t.growth,
          volume: t.volume,
        }))
      }
    } catch {
      // fall through to mock
    }
  }
  return buildMockTrendingForCountry(code)
}

export function computeExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + WORLD_RADAR_CACHE_TTL_MS)
}

export async function runWorldRadarScan(countryCode: string): Promise<{
  winners: ScannedWinner[]
  trending: ScannedTrending[]
  scannedAt: Date
  expiresAt: Date
}> {
  const scannedAt = new Date()
  const [winners, trending] = await Promise.all([
    scanCountryWinners(countryCode),
    scanCountryTrending(countryCode),
  ])
  console.log("[RADAR]", {
    result: "scanned",
    country: countryCode.toUpperCase(),
    winners: winners.length,
    trending: trending.length,
  })
  return {
    winners,
    trending,
    scannedAt,
    expiresAt: computeExpiresAt(scannedAt),
  }
}

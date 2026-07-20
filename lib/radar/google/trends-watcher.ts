import "server-only"

import { serperSearchRaw, isSerperConfigured } from "@/lib/radar/crawler/serper-client"
import { radarFetch } from "@/lib/radar/crawler/http"
import type { TrendingKeyword } from "@/lib/radar/crawler/types"

const GROWTH_THRESHOLD = 50

type SerpTrendRow = {
  keyword?: string
  query?: string
  volume?: number
  search_volume?: number
  growth?: number
  growth_percentage?: number
  increase_percentage?: number
}

function parseTrendsPayload(json: unknown, seedKeywords: string[]): TrendingKeyword[] {
  const out: TrendingKeyword[] = []
  const root = (json && typeof json === "object" ? json : {}) as Record<string, unknown>

  const candidates: unknown[] = []
  if (Array.isArray(root.trends)) candidates.push(...root.trends)
  if (Array.isArray(root.related_queries)) candidates.push(...root.related_queries)
  if (Array.isArray(root.organic)) candidates.push(...root.organic)
  if (Array.isArray(root.interest_over_time)) candidates.push(...root.interest_over_time)

  const related = root.related_searches
  if (Array.isArray(related)) candidates.push(...related)
  if (related && typeof related === "object") {
    const rising = (related as { rising?: unknown[] }).rising
    if (Array.isArray(rising)) candidates.push(...rising)
  }

  for (const row of candidates) {
    if (!row || typeof row !== "object") continue
    const r = row as SerpTrendRow
    const keyword = String(r.keyword ?? r.query ?? "").trim().toLowerCase()
    if (!keyword) continue
    const volume = Number(r.volume ?? r.search_volume ?? 0) || 0
    const growth = Number(r.growth ?? r.growth_percentage ?? r.increase_percentage ?? 0) || 0
    if (growth > GROWTH_THRESHOLD) {
      out.push({ keyword, volume, growth })
    }
  }

  if (out.length === 0 && seedKeywords.length > 0) {
    console.log("[radar/trends]", { result: "no_high_growth", seeds: seedKeywords.length })
  }

  return out
}

/**
 * Google Trends via Serper / SerpAPI (no official Trends API).
 * Missing SERPER_API_KEY → [] (degraded); never throws for missing config.
 */
export async function getTrendingKeywords(
  seedKeywords: string[]
): Promise<TrendingKeyword[]> {
  const seeds = seedKeywords.map((s) => s.trim()).filter(Boolean)
  if (seeds.length === 0) return []

  const serpApiKey = process.env.SERPAPI_API_KEY?.trim() || process.env.SERPAPI_KEY?.trim()

  try {
    if (isSerperConfigured()) {
      const json = await serperSearchRaw(`Google Trends ${seeds.slice(0, 5).join(" OR ")}`, {
        gl: "fr",
      })
      if (!json) {
        console.log("[radar/trends]", { result: "serper_empty" })
        return []
      }
      const parsed = parseTrendsPayload(json, seeds)
      console.log("[radar/trends]", { result: "serper_ok", count: parsed.length })
      return parsed
    }

    if (serpApiKey) {
      const q = encodeURIComponent(seeds.slice(0, 3).join(","))
      const url = `https://serpapi.com/search.json?engine=google_trends&q=${q}&data_type=RELATED_QUERIES&api_key=${serpApiKey}`
      const res = await radarFetch(url, { headers: { accept: "application/json" } })
      if (!res.ok) {
        console.log("[radar/trends]", { result: "serpapi_http_error", status: res.status })
        return []
      }
      const json = await res.json().catch(() => ({}))
      const parsed = parseTrendsPayload(json, seeds)
      console.log("[radar/trends]", { result: "serpapi_ok", count: parsed.length })
      return parsed
    }

    console.warn("[radar/trends]", {
      result: "no_provider_key",
      message: "SERPER_API_KEY missing — Trends skipped (P1 optional)",
    })
    return []
  } catch (err) {
    console.error("[radar/trends]", {
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return []
  }
}

import "server-only"

import { getRadarDb } from "@/lib/prisma-radar"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { DEFAULT_RADAR_COUNTRIES } from "@/lib/radar/crawler/global-scan"

export type CountryCrawlStatus = {
  country: string
  lastCrawledAt: string | null
  snapshots: number
  label: string
}

function relativeLabel(iso: string | null): string {
  if (!iso) return "never"
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return "just now"
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** Last crawl stats per country for admin Multi-Country panel. */
export async function loadCountryCrawlStatuses(
  countries: string[] = [...DEFAULT_RADAR_COUNTRIES]
): Promise<CountryCrawlStatus[]> {
  if (!resolveRadarDatabaseUrl()) {
    return countries.map((country) => ({
      country,
      lastCrawledAt: null,
      snapshots: 0,
      label: "never",
    }))
  }

  try {
    const db = getRadarDb()
    const rows = await db.radarGlobalSnapshot.groupBy({
      by: ["country"],
      where: { country: { in: countries } },
      _count: { _all: true },
      _max: { crawledAt: true },
    })
    const byCc = new Map(
      rows.map((r) => [
        r.country.toUpperCase(),
        {
          snapshots: r._count._all,
          lastCrawledAt: r._max.crawledAt?.toISOString() ?? null,
        },
      ])
    )

    return countries.map((country) => {
      const hit = byCc.get(country.toUpperCase())
      const lastCrawledAt = hit?.lastCrawledAt ?? null
      return {
        country,
        lastCrawledAt,
        snapshots: hit?.snapshots ?? 0,
        label: hit
          ? `${relativeLabel(lastCrawledAt)} ${hit.snapshots} products`
          : "never",
      }
    })
  } catch (err) {
    console.warn("[radar/country-status]", {
      result: "query_failed",
      message: err instanceof Error ? err.message : "unknown",
    })
    return countries.map((country) => ({
      country,
      lastCrawledAt: null,
      snapshots: 0,
      label: "never",
    }))
  }
}

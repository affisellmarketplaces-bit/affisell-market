import { RADAR_DEMO_WINNERS } from "@/lib/radar/demo-data"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { MOCK_MAP_STATS, normalizeRadarMapCountry } from "@/lib/radar/map/geo"
import { getRadarDb } from "@/lib/prisma-radar"

const WINDOW_MS = 24 * 60 * 60 * 1000

export type RadarCountryIntelProduct = {
  id: string
  title: string
  marketplaceId: string
  country: string
  price: number
  currency: string | null
  rank: number | null
  salesEst: number | null
  url: string | null
  imageUrl: string | null
  crawledAt: string
}

export type RadarCountryIntel = {
  country: string
  /** Same universe as map pulse tooltip (24h snapshot count). */
  count: number
  products: RadarCountryIntelProduct[]
  demo: boolean
  windowHours: 24
}

function demoIntel(country: string, take: number): RadarCountryIntel {
  const mock = MOCK_MAP_STATS.find((s) => s.country === country)
  const products = RADAR_DEMO_WINNERS.filter((w) => w.country === country)
    .slice(0, take)
    .map((w) => ({
      id: w.id,
      title: w.title,
      marketplaceId: w.marketplaceId,
      country: w.country,
      price: w.price,
      currency: w.currency,
      rank: w.rank,
      salesEst: w.salesEst,
      url: w.url,
      imageUrl: w.imageUrl,
      crawledAt: w.crawledAt.toISOString(),
    }))

  // If demo winners empty for country, surface mock top title as a synthetic row.
  if (products.length === 0 && mock?.topProductTitle) {
    products.push({
      id: `demo-${country}-top`,
      title: mock.topProductTitle,
      marketplaceId: "tiktok_shop",
      country,
      price: 0,
      currency: null,
      rank: 1,
      salesEst: Math.round(mock.avgSales),
      url: null,
      imageUrl: null,
      crawledAt: new Date().toISOString(),
    })
  }

  return {
    country,
    count: mock?.count ?? products.length,
    products,
    demo: true,
    windowHours: 24,
  }
}

/**
 * Country intel from RadarGlobalSnapshot (map pulse universe) — NOT Affisell catalog.
 */
export async function loadRadarCountryIntel(
  countryRaw: string,
  opts?: { take?: number }
): Promise<RadarCountryIntel | null> {
  const country = normalizeRadarMapCountry(countryRaw)
  if (!country) return null

  const take = Math.min(Math.max(opts?.take ?? 60, 1), 120)

  if (!resolveRadarDatabaseUrl()) {
    return demoIntel(country, take)
  }

  try {
    const db = getRadarDb()
    const since = new Date(Date.now() - WINDOW_MS)

    const [count, rows] = await Promise.all([
      db.radarGlobalSnapshot.count({
        where: { country, crawledAt: { gte: since } },
      }),
      db.radarGlobalSnapshot.findMany({
        where: { country, crawledAt: { gte: since } },
        orderBy: [{ salesEst: "desc" }, { rank: "asc" }, { crawledAt: "desc" }],
        take,
        select: {
          id: true,
          title: true,
          marketplaceId: true,
          country: true,
          price: true,
          currency: true,
          rank: true,
          salesEst: true,
          url: true,
          imageUrl: true,
          crawledAt: true,
        },
      }),
    ])

    if (count === 0 && rows.length === 0) {
      return demoIntel(country, take)
    }

    return {
      country,
      count,
      products: rows.map((r) => ({
        id: r.id,
        title: r.title,
        marketplaceId: r.marketplaceId,
        country: r.country,
        price: Number(r.price),
        currency: r.currency,
        rank: r.rank,
        salesEst: r.salesEst,
        url: r.url,
        imageUrl: r.imageUrl,
        crawledAt: r.crawledAt.toISOString(),
      })),
      demo: false,
      windowHours: 24,
    }
  } catch (err) {
    console.warn("[radar/country-intel]", {
      result: "demo_fallback",
      country,
      message: err instanceof Error ? err.message : "unknown",
    })
    return demoIntel(country, take)
  }
}

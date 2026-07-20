import "server-only"

import { getRadarDb } from "@/lib/prisma-radar"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import type { ScannedTrending, ScannedWinner } from "@/lib/radar/world-scanner"
import { runWorldRadarScan } from "@/lib/radar/world-scanner"
import {
  WORLD_RADAR_COUNTRIES,
  getWorldCountry,
  groupCountriesByRegion,
} from "@/lib/radar/world-countries"
import {
  buildMockTrendingForCountry,
  buildMockWinnersForCountry,
} from "@/lib/radar/world-mock-catalog"
import type {
  WorldRadarCountriesPayload,
  WorldRadarCountryDto,
  WorldRadarPayload,
  WorldRadarTrendingDto,
  WorldRadarWinnerDto,
} from "@/lib/radar/world-radar-types"
import { isCountryScanLive } from "@/lib/radar/world-radar-types"

let worldRadarTablesReady: boolean | null = null

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /does not exist|P2021|RadarCountry|RadarWinner|relation/i.test(msg)
}

export async function probeWorldRadarDb(): Promise<boolean> {
  if (worldRadarTablesReady !== null) return worldRadarTablesReady
  if (!resolveRadarDatabaseUrl()) {
    worldRadarTablesReady = false
    return false
  }
  try {
    const db = getRadarDb()
    await db.radarCountry.count()
    worldRadarTablesReady = true
    return true
  } catch (err) {
    if (isMissingTableError(err)) {
      worldRadarTablesReady = false
      return false
    }
    console.warn("[world-radar-store]", {
      result: "probe_failed",
      message: err instanceof Error ? err.message : "unknown",
    })
    worldRadarTablesReady = false
    return false
  }
}

function winnerToDto(row: {
  id: string
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
}): WorldRadarWinnerDto {
  return {
    id: row.id,
    countryCode: row.countryCode,
    rank: row.rank,
    title: row.title,
    image: row.image,
    source: row.source,
    price: row.price,
    currency: row.currency,
    growthRate: row.growthRate,
    searches: row.searches,
    competition: row.competition,
    trendingScore: row.trendingScore,
    category: row.category,
  }
}

function trendingToDto(row: {
  id?: string
  keyword: string
  growthRate: number
  volume: number | null
}): WorldRadarTrendingDto {
  return {
    id: row.id ?? `trend-${row.keyword}`,
    keyword: row.keyword,
    growthRate: row.growthRate,
    volume: row.volume,
  }
}

function countryDto(
  code: string,
  meta?: { productCount?: number; lastScanAt?: Date | null }
): WorldRadarCountryDto {
  const def = getWorldCountry(code)
  const productCount = meta?.productCount ?? 20
  const lastScanAt = meta?.lastScanAt ?? new Date()
  return {
    code: def?.code ?? code,
    name: def?.name ?? code,
    flag: def?.flag ?? "🌍",
    region: def?.region ?? "Europe",
    currency: def?.currency ?? "EUR",
    enabled: def?.enabled ?? true,
    productCount,
    lastScanAt: lastScanAt ? lastScanAt.toISOString() : null,
    isLive: isCountryScanLive(lastScanAt),
  }
}

function mockPayload(countryCode: string): WorldRadarPayload {
  const code = countryCode.toUpperCase()
  const winners = buildMockWinnersForCountry(code, 20).map((w, i) =>
    winnerToDto({ ...w, id: `mock-${code}-${i + 1}` })
  )
  const trending = buildMockTrendingForCountry(code).map((t) => trendingToDto(t))
  const now = new Date()
  return {
    winners,
    trendingKeywords: trending,
    country: countryDto(code, { productCount: winners.length, lastScanAt: now }),
    lastScanAt: now.toISOString(),
    isLive: true,
    source: "mock",
  }
}

export async function seedWorldRadarCountries(): Promise<number> {
  if (!(await probeWorldRadarDb())) return 0
  const db = getRadarDb()
  let upserted = 0
  for (const c of WORLD_RADAR_COUNTRIES) {
    await db.radarCountry.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        name: c.name,
        flag: c.flag,
        region: c.region,
        currency: c.currency,
        enabled: c.enabled,
      },
      update: {
        name: c.name,
        flag: c.flag,
        region: c.region,
        currency: c.currency,
        enabled: c.enabled,
      },
    })
    upserted += 1
  }
  return upserted
}

export async function persistWorldRadarScan(args: {
  countryCode: string
  winners: ScannedWinner[]
  trending: ScannedTrending[]
  scannedAt: Date
  expiresAt: Date
}): Promise<void> {
  if (!(await probeWorldRadarDb())) return
  const db = getRadarDb()
  const code = args.countryCode.toUpperCase()

  await db.$transaction(async (tx) => {
    await tx.radarWinner.deleteMany({ where: { countryCode: code } })
    await tx.radarTrendingKeyword.deleteMany({ where: { countryCode: code } })

    if (args.winners.length > 0) {
      await tx.radarWinner.createMany({
        data: args.winners.map((w) => ({
          countryCode: w.countryCode,
          rank: w.rank,
          title: w.title,
          image: w.image,
          source: w.source,
          price: w.price,
          currency: w.currency,
          growthRate: w.growthRate,
          searches: w.searches,
          competition: w.competition,
          trendingScore: w.trendingScore,
          category: w.category,
          expiresAt: args.expiresAt,
        })),
      })
    }

    if (args.trending.length > 0) {
      await tx.radarTrendingKeyword.createMany({
        data: args.trending.map((t) => ({
          countryCode: t.countryCode,
          keyword: t.keyword,
          growthRate: t.growthRate,
          volume: t.volume,
          expiresAt: args.expiresAt,
        })),
      })
    }

    await tx.radarCountry.upsert({
      where: { code },
      create: {
        code,
        name: getWorldCountry(code)?.name ?? code,
        flag: getWorldCountry(code)?.flag ?? "🌍",
        region: getWorldCountry(code)?.region ?? "Europe",
        currency: getWorldCountry(code)?.currency ?? "EUR",
        lastScanAt: args.scannedAt,
        productCount: args.winners.length,
      },
      update: {
        lastScanAt: args.scannedAt,
        productCount: args.winners.length,
      },
    })
  })
}

export async function readCachedWorldRadar(countryCode: string): Promise<WorldRadarPayload | null> {
  if (!(await probeWorldRadarDb())) return null
  const db = getRadarDb()
  const code = countryCode.toUpperCase()
  const now = new Date()

  try {
    const [winners, trending, countryRow] = await Promise.all([
      db.radarWinner.findMany({
        where: { countryCode: code, expiresAt: { gt: now } },
        orderBy: [{ trendingScore: "desc" }, { rank: "asc" }],
        take: 20,
      }),
      db.radarTrendingKeyword.findMany({
        where: { countryCode: code, expiresAt: { gt: now } },
        orderBy: { growthRate: "desc" },
        take: 5,
      }),
      db.radarCountry.findUnique({ where: { code } }),
    ])

    if (winners.length === 0) return null

    return {
      winners: winners.map(winnerToDto),
      trendingKeywords: trending.map(trendingToDto),
      country: countryDto(code, {
        productCount: countryRow?.productCount ?? winners.length,
        lastScanAt: countryRow?.lastScanAt ?? winners[0]?.createdAt,
      }),
      lastScanAt: (countryRow?.lastScanAt ?? winners[0]?.createdAt)?.toISOString() ?? null,
      isLive: isCountryScanLive(countryRow?.lastScanAt ?? winners[0]?.createdAt),
      source: "cache",
    }
  } catch (err) {
    if (isMissingTableError(err)) {
      worldRadarTablesReady = false
      return null
    }
    console.warn("[world-radar-store]", {
      result: "cache_read_failed",
      country: code,
      message: err instanceof Error ? err.message : "unknown",
    })
    return null
  }
}

export async function getWorldRadarPayload(
  countryCode: string,
  options?: { coldScan?: boolean }
): Promise<WorldRadarPayload> {
  const code = (countryCode || "FR").trim().toUpperCase()
  if (!getWorldCountry(code)) {
    return mockPayload("FR")
  }

  const cached = await readCachedWorldRadar(code)
  if (cached) return cached

  if (options?.coldScan !== false) {
    try {
      const scan = await runWorldRadarScan(code)
      await persistWorldRadarScan({
        countryCode: code,
        winners: scan.winners,
        trending: scan.trending,
        scannedAt: scan.scannedAt,
        expiresAt: scan.expiresAt,
      }).catch((err) => {
        console.warn("[world-radar-store]", {
          result: "persist_skipped",
          country: code,
          message: err instanceof Error ? err.message : "unknown",
        })
      })

      return {
        winners: scan.winners.map((w, i) => winnerToDto({ ...w, id: `scan-${code}-${i + 1}` })),
        trendingKeywords: scan.trending.map(trendingToDto),
        country: countryDto(code, {
          productCount: scan.winners.length,
          lastScanAt: scan.scannedAt,
        }),
        lastScanAt: scan.scannedAt.toISOString(),
        isLive: true,
        source: "scan",
      }
    } catch (err) {
      console.warn("[world-radar-store]", {
        result: "cold_scan_failed",
        country: code,
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  return mockPayload(code)
}

function mockCountriesPayload(): WorldRadarCountriesPayload {
  const countries = WORLD_RADAR_COUNTRIES.map((c) =>
    countryDto(c.code, { productCount: 20, lastScanAt: new Date() })
  )
  const byRegion = groupCountriesByRegion(
    countries.map((c) => ({
      code: c.code,
      name: c.name,
      flag: c.flag,
      region: c.region as "Europe" | "America" | "Asia" | "Africa" | "Oceania",
      currency: c.currency,
      enabled: c.enabled,
      productCount: c.productCount,
      lastScanAt: c.lastScanAt ? new Date(c.lastScanAt) : null,
    }))
  )
  return {
    countries,
    byRegion: byRegion as Record<string, WorldRadarCountryDto[]>,
    total: countries.length,
  }
}

export async function getWorldRadarCountriesPayload(): Promise<WorldRadarCountriesPayload> {
  const ready = await probeWorldRadarDb()
  if (!ready) return mockCountriesPayload()

  try {
    await seedWorldRadarCountries().catch(() => undefined)
    const db = getRadarDb()
    const rows = await db.radarCountry.findMany({
      where: { enabled: true },
      orderBy: [{ region: "asc" }, { name: "asc" }],
    })

    const countries: WorldRadarCountryDto[] = rows.map((r) =>
      countryDto(r.code, { productCount: r.productCount, lastScanAt: r.lastScanAt })
    )

    const byRegion = groupCountriesByRegion(
      rows.map((r) => ({
        code: r.code,
        name: r.name,
        flag: r.flag,
        region: r.region as "Europe" | "America" | "Asia" | "Africa" | "Oceania",
        currency: r.currency,
        enabled: r.enabled,
        productCount: r.productCount,
        lastScanAt: r.lastScanAt,
      }))
    )

    return {
      countries,
      byRegion: byRegion as Record<string, WorldRadarCountryDto[]>,
      total: countries.length,
    }
  } catch (err) {
    if (isMissingTableError(err)) {
      worldRadarTablesReady = false
    }
    console.warn("[world-radar-store]", {
      result: "countries_fallback_mock",
      message: err instanceof Error ? err.message : "unknown",
    })
    return mockCountriesPayload()
  }
}

export async function scanAndPersistCountries(codes: string[]): Promise<
  Array<{ country: string; winners: number; ok: boolean }>
> {
  const results: Array<{ country: string; winners: number; ok: boolean }> = []
  for (const raw of codes) {
    const country = raw.toUpperCase()
    try {
      const scan = await runWorldRadarScan(country)
      await persistWorldRadarScan({
        countryCode: country,
        winners: scan.winners,
        trending: scan.trending,
        scannedAt: scan.scannedAt,
        expiresAt: scan.expiresAt,
      })
      console.log(`[RADAR] Scanned ${country}: ${scan.winners.length} winners`)
      results.push({ country, winners: scan.winners.length, ok: true })
    } catch (err) {
      console.error("[RADAR]", {
        result: "scan_failed",
        country,
        message: err instanceof Error ? err.message : "unknown",
      })
      results.push({ country, winners: 0, ok: false })
    }
  }
  return results
}

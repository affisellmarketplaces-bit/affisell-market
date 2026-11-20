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
  isGeneratedTrendingKeyword,
} from "@/lib/radar/world-mock-catalog"
import { enrichWorldRadarWinners } from "@/lib/radar/enrich-winners.server"
import type {
  WorldRadarCountriesPayload,
  WorldRadarCountryDto,
  WorldRadarPayload,
  WorldRadarTrendingDto,
  WorldRadarWinnerDto,
} from "@/lib/radar/world-radar-types"
import {
  classifyWinnersOrigin,
  isCountryScanLive,
  isRealWinnerSource,
  radarPayloadFlags,
  trendingForSource,
  type RadarDataSource,
} from "@/lib/radar/world-radar-types"

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
  productId?: string
  isNew?: boolean
  isHot?: boolean
  isLocalWinner?: boolean
  lastWeekRank?: number | null
  finalScore?: number
  supplierLabel?: string
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
    productId: row.productId,
    isNew: row.isNew,
    isHot: row.isHot,
    isLocalWinner: row.isLocalWinner,
    lastWeekRank: row.lastWeekRank ?? null,
    finalScore: row.finalScore,
    supplierLabel: row.supplierLabel,
    // Truthful per-row flag: a row is only "real" when a real provider wrote its source label.
    synthetic: !isRealWinnerSource(row.source),
  }
}

/** `synthetic` must be stated by the caller: a keyword is only "real" when a trends source produced it. */
function trendingToDto(
  row: {
    id?: string
    keyword: string
    growthRate: number
    volume: number | null
  },
  synthetic: boolean
): WorldRadarTrendingDto {
  return {
    id: row.id ?? `trend-${row.keyword}`,
    keyword: row.keyword,
    growthRate: row.growthRate,
    volume: row.volume,
    synthetic,
  }
}

function countryDto(
  code: string,
  meta?: { productCount?: number; lastScanAt?: Date | null }
): WorldRadarCountryDto {
  const def = getWorldCountry(code)
  // No scan date unless a real scan provided one: it used to default to "now", which made every country look freshly scanned.
  const productCount = meta?.productCount ?? 0
  const lastScanAt = meta?.lastScanAt ?? null
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

/**
 * The deterministic generator's payload (lib/radar/scoring-engine.ts). It is SIMULATED: `source: "mock"`, never live, no scan
 * date. It used to claim `isLive: true` and `lastScanAt: now`.
 */
async function mockPayload(countryCode: string): Promise<WorldRadarPayload> {
  const code = countryCode.toUpperCase()
  const winners = buildMockWinnersForCountry(code, 20).map((w) =>
    winnerToDto({ ...w, id: `v2-${w.productId}` })
  )
  // The generator's keywords are the hand-typed list + random jitter: every one is flagged synthetic (this payload is a demo).
  const trending = buildMockTrendingForCountry(code).map((t) => trendingToDto(t, true))
  return {
    winners: await enrichWorldRadarWinners(winners),
    trendingKeywords: trending,
    country: countryDto(code, { productCount: winners.length, lastScanAt: null }),
    lastScanAt: null,
    source: "mock",
    servedFrom: "mock",
    ...radarPayloadFlags("mock", null),
  }
}

/**
 * Adds the Arbitrage / Saturation / Supplier-match columns to the winners it is GIVEN. It never replaces them: it used to
 * throw away scanned (real) rows and serve a fresh generated pool instead — real data silently overwritten by the mock.
 */
async function withMoats(payload: WorldRadarPayload): Promise<WorldRadarPayload> {
  return {
    ...payload,
    winners: await enrichWorldRadarWinners(payload.winners),
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

  // A scan that produced only simulated rows is NOT stored: persisting it would stamp the country with a scan date and
  // serve generated rows from the "cache" as if they had been crawled.
  if (classifyWinnersOrigin(args.winners) === "mock") {
    console.log("[world-radar-store]", { result: "persist_skipped_simulated", country: code, winners: args.winners.length })
    return
  }

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

    const origin: RadarDataSource = classifyWinnersOrigin(winners)
    const scannedAt = countryRow?.lastScanAt ?? winners[0]?.createdAt
    return {
      winners: winners.map(winnerToDto),
      // The old scan stored the generated list next to real winners: recognise it, and never serve it under a live payload.
      trendingKeywords: trendingForSource(
        origin,
        trending.map((t) => trendingToDto(t, isGeneratedTrendingKeyword(t.keyword)))
      ),
      country: countryDto(code, {
        productCount: countryRow?.productCount ?? winners.length,
        lastScanAt: scannedAt,
      }),
      lastScanAt: scannedAt?.toISOString() ?? null,
      source: origin,
      servedFrom: "cache",
      ...radarPayloadFlags(origin, scannedAt),
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
  // Rows stored by an older version of the scan may be simulated (their source label is not a real provider's): they are not
  // served as a cache hit — the request falls through to a real scan, and to the clearly labelled generator if that finds nothing.
  if (cached && cached.source !== "mock") return withMoats(cached)

  if (options?.coldScan !== false) {
    try {
      const scan = await runWorldRadarScan(code)
      const origin = classifyWinnersOrigin(scan.winners)
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

      if (origin !== "mock") {
        return withMoats({
          winners: scan.winners.map((w, i) =>
            winnerToDto({
              ...w,
              id: w.productId ? `v2-${w.productId}` : `scan-${code}-${i + 1}`,
            })
          ),
          // the scanner only returns keywords a trends source produced (no generated fallback any more)
          trendingKeywords: trendingForSource(
            origin,
            scan.trending.map((t) => trendingToDto(t, false))
          ),
          country: countryDto(code, {
            productCount: scan.winners.length,
            lastScanAt: scan.scannedAt,
          }),
          lastScanAt: scan.scannedAt.toISOString(),
          source: origin,
          servedFrom: "scan",
          ...radarPayloadFlags(origin, scan.scannedAt),
        })
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

/** Radar database unreachable: the 31 markets are listed, but nothing was scanned (no date, no counts, never live). */
function mockCountriesPayload(): WorldRadarCountriesPayload {
  const countries = WORLD_RADAR_COUNTRIES.map((c) =>
    countryDto(c.code, { productCount: 0, lastScanAt: null })
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
    source: "mock",
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
      source: "live",
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
  Array<{ country: string; winners: number; ok: boolean; origin?: RadarDataSource; persisted?: boolean }>
> {
  const results: Array<{
    country: string
    winners: number
    ok: boolean
    origin?: RadarDataSource
    persisted?: boolean
  }> = []
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
      const origin = classifyWinnersOrigin(scan.winners)
      console.log(`[RADAR] Scanned ${country}: ${scan.winners.length} winners (${origin})`)
      // `persisted: false` = the scan only produced simulated rows, which are never stored (see persistWorldRadarScan).
      results.push({ country, winners: scan.winners.length, ok: true, origin, persisted: origin !== "mock" })
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

#!/usr/bin/env tsx
/**
 * Seed World Radar countries + initial winners for FR, DE, US, UK, JP, BR, MA.
 * Idempotent CLI — no Next.js / server-only imports.
 *
 * Usage: npm run radar:seed:world
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadEnv } from "dotenv"

import { WORLD_RADAR_COUNTRIES, getWorldCountry } from "../lib/radar/world-countries"
import {
  buildMockTrendingForCountry,
  buildMockWinnersForCountry,
} from "../lib/radar/world-mock-catalog"
import { WORLD_RADAR_CACHE_TTL_MS } from "../lib/radar/world-radar-types"

const root = resolve(import.meta.dirname, "..")
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) loadEnv({ path, override: true })
}

const PRIORITY = ["FR", "DE", "US", "UK", "JP", "BR", "MA"] as const

function isDockerLocalRadarUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname === "localhost" || u.hostname === "127.0.0.1"
    return host && (u.port === "5434" || u.port === "")
  } catch {
    return /localhost:5434|127\.0\.0\.1:5434/.test(url)
  }
}

function resolveRadarUrl(): string | undefined {
  const radar = process.env.RADAR_DATABASE_URL?.trim()
  if (radar && !isDockerLocalRadarUrl(radar)) return radar

  const mi = process.env.MARKET_INTELLI_DATABASE_URL?.trim()
  if (mi && !isDockerLocalRadarUrl(mi)) return mi

  return (
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    undefined
  )
}

type RadarDb = {
  radarCountry: {
    count: () => Promise<number>
    upsert: (args: {
      where: { code: string }
      create: Record<string, unknown>
      update: Record<string, unknown>
    }) => Promise<unknown>
  }
  radarWinner: {
    deleteMany: (args: { where: { countryCode: string } }) => Promise<unknown>
    createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<unknown>
  }
  radarTrendingKeyword: {
    deleteMany: (args: { where: { countryCode: string } }) => Promise<unknown>
    createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<unknown>
  }
  $disconnect: () => Promise<void>
}

function createRadarDb(url: string): RadarDb {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require(".prisma/client-mi") as {
    PrismaClient: new (args?: {
      datasources?: { db?: { url?: string } }
      log?: Array<"error" | "warn">
    }) => RadarDb
  }
  return new PrismaClient({
    datasources: { db: { url } },
    log: ["error", "warn"],
  })
}

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /does not exist|P2021|RadarCountry|RadarWinner|relation/i.test(msg)
}

async function seedCountries(db: RadarDb): Promise<number> {
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

async function seedCountryWinners(
  db: RadarDb,
  countryCode: string
): Promise<{ country: string; winners: number; trending: number; ok: boolean }> {
  const code = countryCode.toUpperCase()
  const scannedAt = new Date()
  const expiresAt = new Date(scannedAt.getTime() + WORLD_RADAR_CACHE_TTL_MS)
  const winners = buildMockWinnersForCountry(code, 20)
  const trending = buildMockTrendingForCountry(code)
  const def = getWorldCountry(code)

  try {
    await db.radarWinner.deleteMany({ where: { countryCode: code } })
    await db.radarTrendingKeyword.deleteMany({ where: { countryCode: code } })

    if (winners.length > 0) {
      await db.radarWinner.createMany({
        data: winners.map((w) => ({
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
          expiresAt,
        })),
      })
    }

    if (trending.length > 0) {
      await db.radarTrendingKeyword.createMany({
        data: trending.map((t) => ({
          countryCode: t.countryCode,
          keyword: t.keyword,
          growthRate: t.growthRate,
          volume: t.volume,
          expiresAt,
        })),
      })
    }

    await db.radarCountry.upsert({
      where: { code },
      create: {
        code,
        name: def?.name ?? code,
        flag: def?.flag ?? "🌍",
        region: def?.region ?? "Europe",
        currency: def?.currency ?? "EUR",
        lastScanAt: scannedAt,
        productCount: winners.length,
      },
      update: {
        lastScanAt: scannedAt,
        productCount: winners.length,
      },
    })

    console.log(`[RADAR] Scanned ${code}: ${winners.length} winners`)
    return { country: code, winners: winners.length, trending: trending.length, ok: true }
  } catch (err) {
    console.error("[seed-world-radar]", {
      result: "country_failed",
      country: code,
      message: err instanceof Error ? err.message : "unknown",
    })
    return { country: code, winners: 0, trending: 0, ok: false }
  }
}

async function main() {
  const url = resolveRadarUrl()
  if (!url) {
    console.error(
      "[seed-world-radar] No DATABASE_URL / RADAR_DATABASE_URL — set Neon URL in .env.local"
    )
    process.exit(1)
  }

  const db = createRadarDb(url)

  try {
    await db.radarCountry.count()
  } catch (err) {
    if (isMissingTableError(err)) {
      console.log(
        "[seed-world-radar] Tables missing — run `npm run radar:db:push` first, then retry"
      )
      await db.$disconnect().catch(() => undefined)
      process.exit(0)
    }
    console.error("[seed-world-radar]", {
      result: "probe_failed",
      message: err instanceof Error ? err.message : "unknown",
    })
    await db.$disconnect().catch(() => undefined)
    process.exit(1)
  }

  const seeded = await seedCountries(db)
  console.log("[seed-world-radar]", { result: "countries_seeded", count: seeded })

  const results = []
  for (const code of PRIORITY) {
    results.push(await seedCountryWinners(db, code))
  }
  console.log("[seed-world-radar]", { result: "winners_seeded", results })

  await db.$disconnect()
  process.exit(0)
}

main().catch(async (err) => {
  console.error("[seed-world-radar]", {
    result: "error",
    message: err instanceof Error ? err.message : "unknown",
  })
  process.exit(1)
})

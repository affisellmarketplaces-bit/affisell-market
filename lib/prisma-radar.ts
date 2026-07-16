import "server-only"

import type { PrismaClient } from ".prisma/client-mi"

import { resolveRadarDatabaseUrl } from "@/lib/radar/env"

const globalForRadar = globalThis as unknown as { radarDb?: PrismaClient }

function createRadarDb(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient: RadarPrismaClient } = require(".prisma/client-mi") as {
    PrismaClient: new (args?: {
      datasources?: { db?: { url?: string } }
      log?: Array<"error" | "warn">
    }) => PrismaClient
  }

  const explicit =
    process.env.RADAR_DATABASE_URL?.trim() ||
    process.env.MARKET_INTELLI_DATABASE_URL?.trim() ||
    ""
  const url = resolveRadarDatabaseUrl()
  if (!url) {
    throw new Error(
      "[prisma-radar] No database URL — set RADAR_DATABASE_URL or DATABASE_URL (Neon)"
    )
  }

  const usedFallback =
    !explicit ||
    /localhost:5434|127\.0\.0\.1:5434/.test(explicit) ||
    url !== explicit
  if (usedFallback && (process.env.DATABASE_URL?.trim() || process.env.DATABASE_URL_UNPOOLED?.trim())) {
    console.log("[prisma-radar]", {
      result: "using_affisell_database_url_fallback",
      schema: "market_intelli",
    })
  }

  return new RadarPrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

/** Lazy singleton — safe for build when RADAR_ENABLED=false (no import-time connect). */
export function getRadarDb(): PrismaClient {
  if (!globalForRadar.radarDb) {
    globalForRadar.radarDb = createRadarDb()
  }
  return globalForRadar.radarDb
}

/** @deprecated Use getRadarDb — kept for Market Intelli transition. */
export function getMiDb(): PrismaClient {
  return getRadarDb()
}

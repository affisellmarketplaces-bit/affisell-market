import "server-only"

import type { PrismaClient } from ".prisma/client-mi"

import { RADAR_DATABASE_URL } from "@/lib/radar/env"

const globalForRadar = globalThis as unknown as { radarDb?: PrismaClient }

function createRadarDb(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient: RadarPrismaClient } = require(".prisma/client-mi") as {
    PrismaClient: new (args?: {
      datasources?: { db?: { url?: string } }
      log?: Array<"error" | "warn">
    }) => PrismaClient
  }

  const url = RADAR_DATABASE_URL
  if (!url) {
    throw new Error(
      "[prisma-radar] RADAR_DATABASE_URL (or MARKET_INTELLI_DATABASE_URL fallback) is not configured"
    )
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

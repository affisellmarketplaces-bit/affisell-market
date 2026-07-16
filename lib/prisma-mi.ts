import "server-only"

import type { PrismaClient } from ".prisma/client-mi"

import { resolveRadarDatabaseUrl } from "@/lib/radar/env"

const globalForMi = globalThis as unknown as { miDb?: PrismaClient }

function createMiDb(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient: MiPrismaClient } = require(".prisma/client-mi") as {
    PrismaClient: new (args?: {
      datasources?: { db?: { url?: string } }
      log?: Array<"error" | "warn">
    }) => PrismaClient
  }

  const url = resolveRadarDatabaseUrl()
  if (!url) {
    throw new Error(
      "[prisma-mi] RADAR_DATABASE_URL (or MARKET_INTELLI_DATABASE_URL fallback) is not configured"
    )
  }
  return new MiPrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

/** Lazy singleton — safe for build when MI flag is off (no import-time connect). */
export function getMiDb(): PrismaClient {
  if (!globalForMi.miDb) {
    globalForMi.miDb = createMiDb()
  }
  return globalForMi.miDb
}

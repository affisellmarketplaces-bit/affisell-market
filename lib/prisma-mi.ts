import "server-only"

import type { PrismaClient } from ".prisma/client-mi"

const globalForMi = globalThis as unknown as { miDb?: PrismaClient }

function createMiDb(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient: MiPrismaClient } = require(".prisma/client-mi") as {
    PrismaClient: new (args?: {
      datasources?: { db?: { url?: string } }
      log?: Array<"error" | "warn">
    }) => PrismaClient
  }

  const url = process.env.MARKET_INTELLI_DATABASE_URL?.trim()
  if (!url) {
    throw new Error("[prisma-mi] MARKET_INTELLI_DATABASE_URL is not configured")
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

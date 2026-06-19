#!/usr/bin/env npx tsx
/**
 * Release stuck Prisma migration advisory locks on Postgres (Neon P1002).
 *
 * Usage:
 *   npm run db:unlock              # terminate blocking sessions
 *   npm run db:unlock -- --diagnose # list only, no terminate
 */
import { config } from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { PrismaClient } from "@prisma/client"

const root = process.cwd()
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) config({ path, override: true })
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./ensure-direct-url.mjs")

const diagnoseOnly = process.argv.includes("--diagnose")

type LockRow = {
  pid: number
  query_start: Date | null
  query: string | null
  state: string | null
}

type AdvisoryLockRow = {
  pid: number
  mode: string
  granted: boolean
  query_start: Date | null
  state: string | null
  application_name: string | null
  query: string | null
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      // Prefer direct host for admin queries (terminate_backend on other sessions).
      url:
        process.env.DATABASE_URL_UNPOOLED?.trim() ||
        process.env.DIRECT_URL?.trim() ||
        process.env.DATABASE_URL?.trim(),
    },
  },
})

async function listAdvisoryLockSessions(): Promise<LockRow[]> {
  return prisma.$queryRaw<LockRow[]>`
    SELECT pid, query_start, query, state
    FROM pg_stat_activity
    WHERE query LIKE '%pg_advisory_lock%'
      AND pid <> pg_backend_pid()
    ORDER BY query_start ASC NULLS LAST
  `
}

async function listAdvisoryLockHolders(): Promise<AdvisoryLockRow[]> {
  return prisma.$queryRaw<AdvisoryLockRow[]>`
    SELECT l.pid, l.mode, l.granted, a.query_start, a.state, a.application_name,
      LEFT(a.query, 200) AS query
    FROM pg_locks l
    JOIN pg_stat_activity a ON l.pid = a.pid
    WHERE l.locktype = 'advisory'
      AND a.pid <> pg_backend_pid()
    ORDER BY l.granted DESC, a.query_start ASC NULLS LAST
  `
}

async function terminateAdvisoryLockSessions(): Promise<number[]> {
  const locked = await listAdvisoryLockHolders()
  const pids = [...new Set(locked.map((row) => row.pid))]
  if (pids.length === 0) return []

  for (const pid of pids) {
    await prisma.$executeRaw`SELECT pg_terminate_backend(${pid}::integer)`
  }
  return pids
}

async function main() {
  const dbHost = (() => {
    try {
      const url = new URL(
        process.env.DATABASE_URL_UNPOOLED ||
          process.env.DIRECT_URL ||
          process.env.DATABASE_URL ||
          ""
      )
      return url.hostname
    } catch {
      return "(unknown)"
    }
  })()

  console.log("[unlock-migrations]", {
    host: dbHost,
    diagnoseOnly,
    hasUnpooled: Boolean(process.env.DATABASE_URL_UNPOOLED?.trim()),
    hasDirectUrl: Boolean(process.env.DIRECT_URL?.trim()),
  })

  const holders = await listAdvisoryLockHolders()
  const before = await listAdvisoryLockSessions()
  console.log("[unlock-migrations]", {
    advisoryLockHolders: holders.length,
    holders,
    queryMatchedSessions: before.length,
    sessions: before,
  })

  if (holders.length === 0 && before.length === 0) {
    console.log("[unlock-migrations]", { result: "no advisory lock sessions found" })
    return
  }

  if (diagnoseOnly) {
    console.log("[unlock-migrations]", { result: "diagnose only — no sessions terminated" })
    return
  }

  const terminatedPids = await terminateAdvisoryLockSessions()
  const after = await listAdvisoryLockSessions()

  console.log("[unlock-migrations]", {
    result: "terminated",
    terminatedPids,
    remainingSessions: after.length,
    remaining: after,
  })
}

main()
  .catch((error) => {
    console.error("[unlock-migrations]", {
      error: error instanceof Error ? error.message : String(error),
    })
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

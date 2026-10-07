#!/usr/bin/env npx tsx
/**
 * Diagnose — and, only on purpose, release — a STALE Prisma Migrate advisory lock (Neon P1002 "Timed out trying to acquire a
 * postgres advisory lock").
 *
 *   DATABASE_URL='<url>' npm run db:unlock                                   diagnose only (default): lists every advisory lock
 *   DATABASE_URL='<url>' npm run db:unlock -- --terminate --pid <n> --expect-endpoint <ep> [--confirm-production]
 *
 * This is NOT part of any pipeline. It used to run before every Vercel build and terminated EVERY session holding ANY advisory
 * lock — including the `pg_advisory_xact_lock` the application takes inside payment, fulfilment and Medusa-sync transactions.
 * Now:
 *   - the database is the explicit DATABASE_URL (no .env file is read — importing @prisma/client would otherwise load one);
 *   - nothing is terminated unless you ask, for ONE pid, and only if that session holds Prisma's migration lock
 *     (`pg_advisory_lock(72707369)`) and nothing else, is idle (not executing) and has been for a while
 *     (scripts/schema-deploy.mjs → classifyAdvisoryLocks);
 *   - application locks are listed, never terminated.
 */
import { classifyDatabaseUrl, classifyAdvisoryLocks } from "./schema-deploy.mjs"
import { directUrlOf, normalizeEndpoint } from "./prisma-explicit-db.mjs"

/** Captured BEFORE anything that could load a .env file (see the note above). */
const EXPLICIT_DATABASE_URL = process.env.DATABASE_URL?.trim() ?? ""

const LOCKS_SQL = `
  SELECT l.pid::int AS pid, l.classid::text AS classid, l.objid::text AS objid, l.objsubid::int AS objsubid, l.granted,
         a.state, EXTRACT(EPOCH FROM (now() - a.state_change))::int AS state_age_seconds, a.application_name
  FROM pg_locks l
  JOIN pg_stat_activity a ON a.pid = l.pid
  WHERE l.locktype = 'advisory' AND l.pid <> pg_backend_pid()
  ORDER BY l.pid`

function parseArgs(argv: string[]) {
  const options = { terminate: false, pid: 0, expectEndpoint: "", confirmProduction: false, error: "" }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--terminate") options.terminate = true
    else if (arg === "--pid") options.pid = Number(argv[++i])
    else if (arg === "--expect-endpoint") options.expectEndpoint = argv[++i] ?? ""
    else if (arg === "--confirm-production") options.confirmProduction = true
    else if (arg === "--diagnose") continue // the default; accepted for old habits
    else options.error = `unknown argument "${arg}"`
  }
  return options
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2))
  if (options.error) {
    console.error(`✗ ${options.error}`)
    return 2
  }
  if (!/^postgres(?:ql)?:\/\//i.test(EXPLICIT_DATABASE_URL)) {
    console.error("✗ DATABASE_URL is not set. Pass it explicitly (this script never reads .env files):  DATABASE_URL='…' npm run db:unlock")
    return 2
  }
  const target = classifyDatabaseUrl(EXPLICIT_DATABASE_URL)
  console.log(`[unlock-migrations] target ${target.maskedHost} (endpoint ${target.endpoint}, branch ${target.branch})`)

  if (options.terminate) {
    if (!Number.isInteger(options.pid) || options.pid <= 0) {
      console.error("✗ --terminate needs --pid <n> (one session at a time; run without --terminate to list them)")
      return 2
    }
    if (!options.expectEndpoint || normalizeEndpoint(options.expectEndpoint) !== target.endpoint) {
      console.error(`✗ --terminate needs --expect-endpoint ${target.endpoint} (say which database you mean to change). Nothing was run.`)
      return 2
    }
    if (target.branch === "production" && !options.confirmProduction) {
      console.error("✗ this is the PRODUCTION database: re-run with --confirm-production. Nothing was run.")
      return 2
    }
  }

  // Imported only now that an explicit URL exists (the import loads .env into process.env when DATABASE_URL is unset).
  const { PrismaClient } = await import("@prisma/client")
  // Prefer the direct host for admin queries (pg_terminate_backend on other sessions does not go through a pooler).
  const prisma = new PrismaClient({ datasources: { db: { url: directUrlOf(EXPLICIT_DATABASE_URL) } }, log: [] })
  try {
    const rows = (await prisma.$queryRawUnsafe(LOCKS_SQL)) as Parameters<typeof classifyAdvisoryLocks>[0]
    const sessions = classifyAdvisoryLocks(rows)
    if (sessions.length === 0) {
      console.log("[unlock-migrations] no advisory lock held or awaited — nothing to do")
      return 0
    }
    for (const s of sessions) {
      console.log(
        `[unlock-migrations] pid ${s.pid} · ${s.kind} · ${s.state} (${s.idleSeconds}s) · ${s.applicationName ?? "-"} · ` +
          (s.terminable ? "TERMINABLE" : `kept: ${s.reasons.join("; ")}`)
      )
    }
    if (!options.terminate) {
      console.log("[unlock-migrations] diagnose only — nothing was terminated")
      return 0
    }

    const chosen = sessions.find((s) => s.pid === options.pid)
    if (!chosen) {
      console.error(`✗ pid ${options.pid} holds no advisory lock. Nothing was terminated.`)
      return 2
    }
    if (!chosen.terminable) {
      console.error(`✗ pid ${options.pid} is not a stale Prisma migration session: ${chosen.reasons.join("; ")}. Nothing was terminated.`)
      return 2
    }
    await prisma.$queryRaw`SELECT pg_terminate_backend(${options.pid}::integer)`
    console.log(`[unlock-migrations] terminated pid ${options.pid} (a stale Prisma migration lock). Re-run the migration.`)
    return 0
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("[unlock-migrations]", { error: error instanceof Error ? error.message : String(error) })
    process.exit(3)
  })

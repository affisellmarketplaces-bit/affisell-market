#!/usr/bin/env node
/**
 * SCHEMA MIGRATE → SCHEMA VERIFY → (APPLICATION BUILD → DEPLOY, elsewhere). A migration is its own step, run on purpose BEFORE the
 * push; the Vercel build only ever VERIFIES.
 *
 *   npm run schema:migrate   check the target → read the migration state → `migrate deploy` → status → verify the catalog
 *                            LOCAL ONLY (a developer / CI job that names the database): a Vercel build refuses it, whatever calls it
 *   npm run schema:verify    check the target → the schema must be up to date AND the catalog must hold what the code needs;
 *                            runs in a session the DATABASE SERVER keeps read-only (any write would be refused by PostgreSQL)
 *
 * Both HARD-FAIL: every problem is a non-zero exit code, and `scripts/vercel-build.mjs` stops there — no application build,
 * hence no deployment. Nothing in here records a failed migration as applied (`resolve --rolled-back` exists in
 * scripts/prisma-explicit-db.mjs, `--applied` deliberately does not), and nothing kills a database session.
 *
 * Exit codes: 0 ok · 2 refused before touching anything · 3 Prisma did not name the expected endpoint · 4 migration failed or
 * its state is not readable · 5 the schema verification failed.
 *
 * Which database: ONLY `DATABASE_URL` of the environment (`.env` files are never read), and `DATABASE_URL_UNPOOLED` / `DIRECT_URL`,
 * when set, must name the SAME endpoint — Prisma used to prefer them over `DATABASE_URL`, so a stale one could migrate another
 * database than the one the application uses.
 *   - Vercel Production   (VERCEL=1, VERCEL_ENV=production)       the database must not be staging / local
 *   - Vercel Preview/Dev  (VERCEL=1, VERCEL_ENV=preview|development) the database must be PROVABLY not production: staging only
 *   - VERCEL=1 on a developer machine (secret .env files present)    refused: `vercel build` locally is not a Vercel builder
 *   - local                                                           `--expect-endpoint` for `migrate`; production also `--confirm-production`
 */
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { setTimeout as sleepMs } from "node:timers/promises"
import { fileURLToPath } from "node:url"

import { hasDeveloperEnvFiles } from "./build-isolated.mjs"
import { parseDatabaseUrl } from "./env-shared.mjs"
import {
  buildChildEnv,
  createExplicitConfig,
  endpointOf,
  isTransientDbError,
  isUpToDate,
  normalizeEndpoint,
  parseFailedMigrations,
  parsePendingMigrations,
  quiet,
  runPrisma,
} from "./prisma-explicit-db.mjs"

export const EXIT = { OK: 0, REFUSED: 2, UNPROVEN_TARGET: 3, MIGRATION_FAILED: 4, VERIFY_FAILED: 5 }

/** Neon cold start / a lock held by a concurrent run: retried, then it is a failure. Same delays the old pipeline used. */
export const RETRY_DELAYS_MS = [3_000, 5_000, 8_000, 12_000, 15_000, 20_000]

/** The variables that can name the database Prisma talks to. `DATABASE_URL` is the one the application uses. */
export const DATABASE_URL_VARIABLES = ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "DIRECT_URL"]

/* ---------------------------------------------------------------------------------------------------------------
 * Policy: which database may this run touch? Pure — no I/O.
 * ------------------------------------------------------------------------------------------------------------- */

/** @returns {{ kind: "local" | "vercel-production" | "vercel-preview" | "vercel-unknown", vercelEnv: string }} */
export function detectDeployContext(env) {
  if (env.VERCEL !== "1") return { kind: "local", vercelEnv: "" }
  const vercelEnv = String(env.VERCEL_ENV ?? "").trim().toLowerCase()
  if (vercelEnv === "production") return { kind: "vercel-production", vercelEnv }
  if (vercelEnv === "preview" || vercelEnv === "development") return { kind: "vercel-preview", vercelEnv }
  return { kind: "vercel-unknown", vercelEnv }
}

/**
 * Neon branch of a URL. A host that is neither localhost, Neon production nor Neon staging is "unknown" — never "local":
 * `scripts/env-shared.mjs` calls every non-Neon host "local", which would let a production database on another provider
 * pass for a harmless one.
 */
export function classifyDatabaseUrl(rawUrl) {
  const parsed = parseDatabaseUrl(rawUrl)
  // `parsed.host` carries the PORT ("127.0.0.1:5433"), so the helper's own `isLocalhost` misses a local URL with a port.
  const hostname = String(parsed.host ?? "").replace(/:\d+$/, "").toLowerCase()
  const isLocal = /^(localhost|127\.0\.0\.1|::1|\[::1\])$/.test(hostname)
  const branch = isLocal ? "local" : parsed.branch === "production" || parsed.branch === "staging" ? parsed.branch : "unknown"
  return { endpoint: endpointOf(parsed), branch, maskedHost: parsed.maskedHost }
}

/**
 * @typedef {{ action: "run", target: { url: string, endpoint: string, branch: string, maskedHost: string }, summary: string[], warnings: string[] }
 *   | { action: "skip", reason: string, summary: string[] }
 *   | { action: "refuse", reason: string, summary: string[] }} TargetVerdict
 * @param {{
 *   command: "migrate" | "verify",
 *   context: ReturnType<typeof detectDeployContext>,
 *   developerMachine: boolean,
 *   env: Record<string, string | undefined>,
 *   expectEndpoint?: string,
 *   confirmProduction?: boolean,
 * }} input
 * @returns {TargetVerdict}
 */
export function assessSchemaTarget({ command, context, developerMachine, env, expectEndpoint = "", confirmProduction = false }) {
  /** @type {string[]} */
  const summary = []
  const refuse = (reason) => ({ action: /** @type {const} */ ("refuse"), reason, summary })
  const vercel = context.kind !== "local"

  if (vercel && developerMachine) {
    return refuse(
      "VERCEL=1 but this is a developer machine (secret .env files are present): `vercel build` run locally is not a Vercel builder and must " +
        "never deploy a schema. Push to git and let Vercel build, or run `npm run schema:migrate -- --expect-endpoint <ep>` on purpose."
    )
  }
  if (context.kind === "vercel-unknown") {
    return refuse(`VERCEL=1 but VERCEL_ENV is "${context.vercelEnv}": cannot tell a production build from a preview.`)
  }
  if (vercel && command === "migrate") {
    return refuse(
      "a Vercel build never applies migrations (migrate is its own step, run BEFORE the push: " +
        "`DATABASE_URL='<url>' npm run schema:migrate -- --expect-endpoint <ep>`). The build only verifies."
    )
  }

  const present = DATABASE_URL_VARIABLES.map((name) => [name, String(env[name] ?? "").trim()]).filter(([, value]) => value)
  if (!String(env.DATABASE_URL ?? "").trim()) {
    if (context.kind === "vercel-preview") {
      return { action: "skip", reason: "preview build without DATABASE_URL: no database to migrate or verify.", summary }
    }
    return refuse(
      context.kind === "vercel-production"
        ? "production build without DATABASE_URL: refusing to ship code that needs a database schema nobody can verify."
        : "DATABASE_URL must be set in the environment of this command (a postgres URL). .env files are never read."
    )
  }

  const classified = []
  for (const [name, value] of present) {
    if (!/^postgres(?:ql)?:\/\//i.test(value)) return refuse(`${name} is not a postgres URL.`)
    const info = classifyDatabaseUrl(value)
    if (!info.endpoint) return refuse(`cannot identify the database endpoint of ${name}.`)
    classified.push({ name, url: value, ...info })
    summary.push(`${name} → ${info.maskedHost} (endpoint ${info.endpoint}, branch ${info.branch})`)
  }
  if (new Set(classified.map((c) => c.endpoint)).size > 1) {
    return refuse(
      "DATABASE_URL, DATABASE_URL_UNPOOLED and DIRECT_URL do not name the same database. A migration could change a database " +
        "other than the one the application uses."
    )
  }

  const target = classified[0]
  /** @type {string[]} */
  const warnings = []
  if (expectEndpoint && normalizeEndpoint(expectEndpoint) !== target.endpoint) {
    return refuse(`--expect-endpoint ${expectEndpoint} does not match the URL's endpoint (${target.endpoint}). Nothing was run.`)
  }

  switch (context.kind) {
    case "vercel-production":
      if (target.branch === "staging" || target.branch === "local") {
        return refuse(`production deployment but DATABASE_URL is the ${target.branch} database (${target.maskedHost}).`)
      }
      if (target.branch === "unknown") warnings.push(`production database ${target.maskedHost} is not a recognised Neon branch`)
      break
    case "vercel-preview":
      if (target.branch === "production") {
        return refuse(
          `a ${context.vercelEnv} deployment points at the PRODUCTION database (${target.maskedHost}). ` +
            "Set DATABASE_URL, DIRECT_URL and DATABASE_URL_UNPOOLED of the Preview environment to the staging branch in the Vercel dashboard."
        )
      }
      if (target.branch === "unknown") {
        return refuse(
          `a ${context.vercelEnv} deployment points at ${target.maskedHost}, which cannot be shown NOT to be production ` +
            "(only the staging branch is accepted for Preview)."
        )
      }
      break
    default:
      if (command === "migrate") {
        if (!expectEndpoint) return refuse("migrate requires --expect-endpoint <ep-id> (say which database you mean to change).")
        if (target.branch === "production" && !confirmProduction) {
          return refuse("this is the PRODUCTION database: re-run with --confirm-production once you have read docs/DEPLOY-SCHEMA-CHANGES.md.")
        }
      }
  }
  return { action: "run", target, summary, warnings }
}

/* ---------------------------------------------------------------------------------------------------------------
 * Orchestration. Everything that touches the world is injected, so the decisions are tested without a database.
 * ------------------------------------------------------------------------------------------------------------- */

const tail = (text, lines = 12) => quiet(text).split("\n").slice(-lines).join("\n")

function failedMigrationGuidance(names) {
  return [
    `✗ [schema] FAILED migration(s) recorded in the database: ${names.join(", ")}`,
    "  Nothing was deployed and nothing will be marked as applied. A failed migration is never retried or hidden automatically.",
    "  1. Look at what is really in the database:  DATABASE_URL='<url>' npm run schema:verify",
    "  2. Remove what the failed run left behind, by hand.",
    "  3. Record the failure as rolled back:       DATABASE_URL='<url>' npm run prisma:explicit -- resolve --rolled-back <name> --expect-endpoint <ep>",
    "  4. Deploy again.                            (docs/DEPLOY-SCHEMA-CHANGES.md §6)",
  ].join("\n")
}

/**
 * @typedef {{ status: number | null, text: string }} StepResult
 * @typedef {{
 *   log: (line: string) => void,
 *   error: (line: string) => void,
 *   sleep: (ms: number) => Promise<void>,
 *   prisma: (subcommand: "status" | "deploy", target: { url: string, endpoint: string }) => StepResult,
 *   verify: (target: { url: string, endpoint: string }) => StepResult,
 * }} SchemaDeps
 * @param {"migrate" | "verify"} command
 * @param {{ env: Record<string, string | undefined>, developerMachine: boolean, expectEndpoint?: string, confirmProduction?: boolean, retryDelaysMs?: number[] }} options
 * @param {SchemaDeps} deps
 * @returns {Promise<number>} the exit code
 */
export async function runSchemaDeploy(command, options, deps) {
  const { log, error, sleep } = deps
  const retryDelaysMs = options.retryDelaysMs ?? RETRY_DELAYS_MS
  const context = detectDeployContext(options.env)
  const verdict = assessSchemaTarget({ command, context, ...options })

  log(`[schema] ${command} · context ${context.kind}${context.vercelEnv ? ` (${context.vercelEnv})` : ""}`)
  for (const line of verdict.summary) log(`[schema]   ${line}`)
  if (verdict.action === "refuse") {
    error(`✗ [schema] REFUSED: ${verdict.reason}`)
    return EXIT.REFUSED
  }
  if (verdict.action === "skip") {
    log(`[schema] skipped: ${verdict.reason}`)
    return EXIT.OK
  }
  for (const warning of verdict.warnings) log(`[schema] warning: ${warning}`)
  const { target } = verdict

  /** @param {() => StepResult} attempt @param {string} label */
  async function withRetry(attempt, label) {
    let result = attempt()
    for (const delay of retryDelaysMs) {
      if (result.status === 0 || !isTransientDbError(result.text)) break
      log(`[schema] ${label}: database unreachable or locked — retrying in ${delay / 1000}s`)
      await sleep(delay)
      result = attempt()
    }
    return result
  }

  const before = await withRetry(() => deps.prisma("status", target), "migrate status")
  if (!before.text.toLowerCase().includes(target.endpoint)) {
    error(`✗ [schema] ABORT: Prisma's own output does not name the endpoint ${target.endpoint}. Nothing was changed.`)
    error(tail(before.text))
    return EXIT.UNPROVEN_TARGET
  }

  const failed = parseFailedMigrations(before.text)
  if (failed.length > 0) {
    error(failedMigrationGuidance(failed))
    return command === "verify" ? EXIT.VERIFY_FAILED : EXIT.MIGRATION_FAILED
  }

  if (command === "verify") {
    if (!isUpToDate(before.text)) {
      const pending = parsePendingMigrations(before.text)
      error(
        `✗ [schema] the schema is NOT up to date: ${pending.length > 0 ? `${pending.join(", ")} not applied` : "Prisma could not confirm it"}.\n${tail(before.text)}`
      )
      return EXIT.VERIFY_FAILED
    }
  } else if (isUpToDate(before.text)) {
    log("[schema] no pending migration")
  } else {
    const pending = parsePendingMigrations(before.text)
    if (pending.length === 0) {
      error(`✗ [schema] the migration state is not readable (history diverged, database not managed by Prisma Migrate, or unreachable). Nothing was deployed.\n${tail(before.text)}`)
      return EXIT.MIGRATION_FAILED
    }
    log(`[schema] ${pending.length} pending migration(s): ${pending.join(", ")}`)
    const deploy = await withRetry(() => deps.prisma("deploy", target), "migrate deploy")
    log(quiet(deploy.text))
    if (deploy.status !== 0) {
      error(`✗ [schema] migrate deploy FAILED (exit ${deploy.status}). The pipeline stops here: no application build, no deployment.`)
      const nowFailed = parseFailedMigrations(deploy.text)
      if (nowFailed.length > 0 || /P3009/.test(deploy.text)) error(failedMigrationGuidance(nowFailed))
      if (/P1002|advisory lock/i.test(deploy.text)) {
        error(
          "  A Prisma migration lock is held (a concurrent run, or a stale one). Nothing was killed. Diagnose with:\n" +
            "    DATABASE_URL='<url>' npm run db:unlock      (read-only unless you pass --terminate --pid <n>)"
        )
      }
      return EXIT.MIGRATION_FAILED
    }
    const after = await deps.prisma("status", target)
    if (!isUpToDate(after.text)) {
      error(`✗ [schema] migrate deploy exited 0 but the schema is still not up to date:\n${tail(after.text)}`)
      return EXIT.MIGRATION_FAILED
    }
  }

  // The proof is the catalog, not `migrate status`.
  const proof = deps.verify(target)
  log(quiet(proof.text))
  if (proof.status !== 0) {
    error("✗ [schema] schema verification FAILED: the database does not hold what this code needs. The pipeline stops here.")
    return EXIT.VERIFY_FAILED
  }
  log(`[schema] ✓ ${command === "migrate" ? "migrated and verified" : "verified"}: ${target.maskedHost}`)
  return EXIT.OK
}

/* ---------------------------------------------------------------------------------------------------------------
 * Stale Prisma migration lock — the safe replacement for the old "kill every session that holds an advisory lock".
 * ------------------------------------------------------------------------------------------------------------- */

/** `SELECT pg_advisory_lock(72707369)`: the lock Prisma Migrate takes (session-level) — read from the schema engine. */
export const PRISMA_MIGRATION_LOCK_KEY = 72707369

/**
 * The application takes `pg_advisory_xact_lock(hashtext(...))` inside payment / fulfilment / Medusa-sync transactions.
 * Those must never be touched. A session is terminable only if it holds Prisma's migration lock and NOTHING else, is
 * idle (not executing), and has been idle long enough that a live migrate run is implausible.
 *
 * @param {Array<{ pid: number|bigint, classid: unknown, objid: unknown, objsubid: unknown, granted: boolean, state: string|null, state_age_seconds: unknown, application_name?: string|null }>} rows one row per advisory lock
 * @param {{ minIdleSeconds?: number }} [options]
 */
export function classifyAdvisoryLocks(rows, { minIdleSeconds = 120 } = {}) {
  /** @type {Map<number, typeof rows>} */
  const byPid = new Map()
  for (const row of rows) {
    const pid = Number(row.pid)
    byPid.set(pid, [...(byPid.get(pid) ?? []), row])
  }
  return [...byPid.entries()]
    .map(([pid, locks]) => {
      const isMigrationLock = (l) =>
        String(l.classid) === "0" && String(l.objid) === String(PRISMA_MIGRATION_LOCK_KEY) && Number(l.objsubid) === 1
      const migration = locks.filter((l) => isMigrationLock(l) && l.granted)
      const waiting = locks.filter((l) => isMigrationLock(l) && !l.granted)
      const others = locks.filter((l) => !isMigrationLock(l))
      const state = locks[0]?.state ?? "unknown"
      const idleFor = Number(locks[0]?.state_age_seconds ?? 0)
      /** @type {string[]} */
      const reasons = []
      if (migration.length === 0 && waiting.length > 0) reasons.push("is WAITING for Prisma's migration lock — it does not hold it (it is the victim, not the cause)")
      else if (migration.length === 0) reasons.push("not Prisma's migration lock — an application lock, never terminated by this tool")
      if (others.length > 0 && migration.length > 0) reasons.push(`also holds ${others.length} other advisory lock(s): not a pure migration session`)
      if (migration.length > 0 && state !== "idle") reasons.push(`state is "${state}" (a migration may be running)`)
      if (migration.length > 0 && state === "idle" && idleFor < minIdleSeconds) reasons.push(`idle for only ${idleFor}s (< ${minIdleSeconds}s)`)
      return {
        pid,
        kind: migration.length > 0 ? "prisma-migration" : waiting.length > 0 ? "prisma-migration-waiting" : "application",
        state,
        idleSeconds: idleFor,
        applicationName: locks[0]?.application_name ?? null,
        reasons,
        terminable: reasons.length === 0,
      }
    })
    .sort((a, b) => a.pid - b.pid)
}

/* ---------------------------------------------------------------------------------------------------------------
 * Wiring to the real world (only runs when the file is executed directly).
 * ------------------------------------------------------------------------------------------------------------- */

function createRealDeps(env, cwd) {
  /** @type {ReturnType<typeof createExplicitConfig> | undefined} */
  let config
  // Everything but `migrate deploy` runs in a session the SERVER keeps read-only.
  const childEnv = (target, readOnly) => buildChildEnv(env, target.url, { readOnly })
  return {
    cleanup: () => config?.cleanup(),
    deps: /** @type {SchemaDeps} */ ({
      log: (line) => console.log(line),
      error: (line) => console.error(line),
      sleep: (ms) => sleepMs(ms),
      prisma(subcommand, target) {
        config ??= createExplicitConfig(cwd)
        return runPrisma(subcommand, childEnv(target, subcommand !== "deploy"), config.configPath, cwd, [], subcommand === "deploy" ? 10 * 60_000 : 3 * 60_000)
      },
      verify(target) {
        const result = spawnSync("npx", ["tsx", "scripts/verify-event-spine.ts"], {
          cwd,
          env: childEnv(target, true),
          encoding: "utf8",
          timeout: 3 * 60_000,
        })
        return { status: result.status, text: `${result.stdout ?? ""}\n${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}` }
      },
    }),
  }
}

/** @param {string[]} argv */
export function parseCli(argv) {
  const [command, ...rest] = argv
  const options = { command, expectEndpoint: "", confirmProduction: false, retry: true, error: "" }
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--expect-endpoint") options.expectEndpoint = rest[++i] ?? ""
    else if (rest[i] === "--confirm-production") options.confirmProduction = true
    else if (rest[i] === "--no-retry") options.retry = false
    else options.error = `unknown argument "${rest[i]}"`
  }
  if (command !== "migrate" && command !== "verify") options.error = "usage: schema-deploy.mjs <migrate|verify> [--expect-endpoint <ep>] [--confirm-production] [--no-retry]"
  return options
}

async function main() {
  const options = parseCli(process.argv.slice(2))
  if (options.error) {
    console.error(`✗ ${options.error}`)
    return EXIT.REFUSED
  }
  const cwd = process.cwd()
  const { deps, cleanup } = createRealDeps(process.env, cwd)
  try {
    return await runSchemaDeploy(/** @type {"migrate" | "verify"} */ (options.command), {
      env: process.env,
      developerMachine: hasDeveloperEnvFiles(cwd),
      expectEndpoint: options.expectEndpoint,
      confirmProduction: options.confirmProduction,
      retryDelaysMs: options.retry ? RETRY_DELAYS_MS : [],
    }, deps)
  } finally {
    cleanup()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error("✗ [schema] failed:", error instanceof Error ? error.message : error)
      process.exit(EXIT.MIGRATION_FAILED)
    })
}

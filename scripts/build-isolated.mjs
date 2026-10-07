#!/usr/bin/env node
/**
 * `npm run build` → this script → `next build`.
 *
 * A build run on a developer machine or in CI has no business reaching a database. Without this wrapper, Next loads
 * `.env.local`, static generation runs application code, and that code connects to whatever DATABASE_URL it finds —
 * on a developer machine, the production one (a local build once ran idempotent DDL on production this way).
 *
 * Behaviour:
 *   - VERCEL=1  on a real Vercel builder (scripts/vercel-build.mjs → `npm run build`): untouched. Static pages keep
 *               reading the database they are configured with. Writes are impossible anyway (lib/build-write-guard.ts).
 *   - VERCEL=1  on a DEVELOPER MACHINE (`vercel build` run locally) is NOT a Vercel builder: `vercel build` sets VERCEL=1
 *               too, which used to switch the isolation off. A real builder never has the secret-bearing env files
 *               (gitignored, never committed) — see DEVELOPER_ENV_FILES — so their presence means "this is a laptop".
 *   - otherwise every database / cache credential is removed from the environment of `next build`, INCLUDING the ones Next
 *               would load from `.env*` files (a variable that is defined, even empty, is never overridden by Next).
 *               The application already builds without a database: CI has none.
 *   - AFFISELL_BUILD_ALLOW_DB=1 keeps the credentials for someone who really wants data at build time, but REFUSES to run
 *               if any of them points at the production database. Writes stay blocked by the guard either way.
 *
 * Pure planning functions are exported for tests; the process is only spawned when this file is run directly.
 */
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parse as parseDotenv } from "dotenv"

import { parseDatabaseUrl } from "./env-shared.mjs"

/** Files Next.js loads for `next build` (NODE_ENV=production), most specific first. */
export const NEXT_BUILD_ENV_FILES = [".env.production.local", ".env.local", ".env.production", ".env"]

/**
 * Secret-bearing env files that are gitignored and were never committed (verified: `git ls-files` lists none). They exist on
 * a developer machine and cannot exist on a Vercel builder, which only has the repository checkout.
 */
export const DEVELOPER_ENV_FILES = [
  ".env",
  ".env.local",
  ".env.development.local",
  ".env.production.local",
  ".env.test.local",
  ".env.pre-local-merge.bak",
]

/** True when the working directory looks like a developer machine rather than a Vercel builder. */
export function hasDeveloperEnvFiles(root, files = DEVELOPER_ENV_FILES) {
  return files.some((name) => existsSync(resolve(root, name)))
}

/** PostgreSQL credentials, by name. Values are also matched by shape (see `collectDatastoreKeys`). */
export const DATABASE_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "DIRECT_URL",
  "DATABASE_URL_STAGING",
  "DATABASE_URL_TEST",
  "DIRECT_URL_TEST",
  "RADAR_DATABASE_URL",
  "MARKET_INTELLI_DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
]

/** Redis / KV credentials (caches and queues are datastores too: a build must not write to a production one). */
export const CACHE_ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "REDIS_URL",
  "KV_URL",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "KV_REST_API_READ_ONLY_TOKEN",
]

export const ISOLATED_ENV_KEYS = [...DATABASE_ENV_KEYS, ...CACHE_ENV_KEYS]

/**
 * Credentials that make the BUILD itself act on a third party. Measured with a network tripwire: with all three SENTRY_* variables
 * set, `next build` runs the Sentry CLI (a native binary) and uploads source maps. That is wanted on Vercel; a local / CI build
 * must not publish a release to the team's Sentry project, so it gets an empty token (the app then skips the plugin entirely:
 * next.config.ts needs token AND org AND project).
 */
export const EXTERNAL_EFFECT_ENV_KEYS = ["SENTRY_AUTH_TOKEN"]

const POSTGRES_URL_RE = /^postgres(?:ql)?:\/\//i
const REDIS_URL_RE = /^rediss?:\/\//i

export const ALLOW_DB_FLAG = "AFFISELL_BUILD_ALLOW_DB"

/** Reads the env files Next would load, as one object per file (never expanded, never written to process.env). */
export function readBuildEnvFiles(root, files = NEXT_BUILD_ENV_FILES) {
  return files.flatMap((name) => {
    const path = resolve(root, name)
    return existsSync(path) ? [parseDotenv(readFileSync(path))] : []
  })
}

/**
 * Every variable name that holds a datastore credential — by well-known name OR because its value is a postgres/redis URL.
 * `postgres` / `cache` select which kind is collected (both by default).
 */
export function collectDatastoreKeys(processEnv, fileEnvs, { postgres = true, cache = true } = {}) {
  const keys = new Set([...(postgres ? DATABASE_ENV_KEYS : []), ...(cache ? CACHE_ENV_KEYS : [])])
  for (const source of [processEnv, ...fileEnvs]) {
    for (const [key, value] of Object.entries(source)) {
      const v = typeof value === "string" ? value.trim() : ""
      if ((postgres && POSTGRES_URL_RE.test(v)) || (cache && REDIS_URL_RE.test(v))) keys.add(key)
    }
  }
  return [...keys].sort()
}

/**
 * What `next build` will actually see: Next only fills a variable from an `.env*` file while it is UNDEFINED, and the
 * first file that defines it wins — so the process environment beats every file, and an earlier file beats a later one.
 * (`fileEnvs` is already in Next's order, most specific first.)
 */
export function effectiveEnvironment(processEnv, fileEnvs) {
  const effective = {}
  for (const file of fileEnvs) {
    for (const [key, value] of Object.entries(file)) {
      if (!(key in effective)) effective[key] = value
    }
  }
  for (const [key, value] of Object.entries(processEnv)) {
    if (value !== undefined) effective[key] = value
  }
  return effective
}

/** The variables (name → host) that would let this build reach the PRODUCTION database — by their EFFECTIVE value. */
export function findProductionDatabaseKeys(processEnv, fileEnvs) {
  const found = new Map()
  for (const [key, value] of Object.entries(effectiveEnvironment(processEnv, fileEnvs))) {
    if (!POSTGRES_URL_RE.test(typeof value === "string" ? value.trim() : "")) continue
    const parsed = parseDatabaseUrl(value)
    if (parsed.branch === "production") found.set(key, parsed.maskedHost)
  }
  return found
}

/**
 * @param {Record<string, string | undefined>} processEnv
 * @param {Record<string, string>[]} fileEnvs
 * @param {{ developerMachine?: boolean }} [options] `developerMachine`: the working directory holds DEVELOPER_ENV_FILES
 * @returns {{ mode: "vercel" | "isolated" | "allow-db" | "refused", env: Record<string, string | undefined>, blanked: string[], production: [string, string][], localVercel?: boolean }}
 */
export function planBuild(processEnv, fileEnvs, options = {}) {
  const localVercel = processEnv.VERCEL === "1" && options.developerMachine === true
  if (processEnv.VERCEL === "1" && !localVercel) {
    return { mode: "vercel", env: { ...processEnv }, blanked: [], production: [] }
  }

  if (processEnv[ALLOW_DB_FLAG] === "1") {
    const production = [...findProductionDatabaseKeys(processEnv, fileEnvs)]
    if (production.length > 0) {
      return { mode: "refused", env: { ...processEnv }, blanked: [], production }
    }
    // Only the (non-production) PostgreSQL URLs are kept. Caches and queues (Redis / KV) are still removed: a production
    // one must stay out of reach of a build whatever database it was allowed to read.
    const blanked = collectDatastoreKeys(processEnv, fileEnvs, { postgres: false, cache: true })
    const env = { ...processEnv }
    for (const key of [...blanked, ...EXTERNAL_EFFECT_ENV_KEYS]) env[key] = ""
    return { mode: "allow-db", env, blanked, production: [], localVercel }
  }

  // Defined-but-empty on purpose: Next only fills in variables that are `undefined`, so `.env.local` cannot bring them back.
  const blanked = collectDatastoreKeys(processEnv, fileEnvs)
  const env = { ...processEnv }
  for (const key of [...blanked, ...EXTERNAL_EFFECT_ENV_KEYS]) env[key] = ""
  return { mode: "isolated", env, blanked, production: [], localVercel }
}

export function describePlan(plan) {
  switch (plan.mode) {
    case "vercel":
      return "[build] Vercel build: the platform's database configuration is left untouched. Database writes are blocked by the build guard (lib/build-write-guard.ts)."
    case "isolated":
      return (
        `[build] Isolated build: ${plan.blanked.length} database / cache credential variable(s) removed from this build. It cannot reach any database. (Set ${ALLOW_DB_FLAG}=1 to keep a NON-production database.)` +
        (plan.localVercel
          ? " VERCEL=1 was set but this is a developer machine (secret .env files present): `vercel build` run locally is not a Vercel builder."
          : "")
      )
    case "allow-db":
      return `[build] ${ALLOW_DB_FLAG}=1: PostgreSQL URLs kept (none points at production), ${plan.blanked.length} cache credential variable(s) removed. Reads are possible; writes are blocked by the build guard.`
    default:
      return (
        `[build] REFUSED: ${ALLOW_DB_FLAG}=1 but these variables point at the PRODUCTION database: ` +
        `${plan.production.map(([k, host]) => `${k} (${host})`).join(", ")}. Remove them from the environment / .env files, or run without ${ALLOW_DB_FLAG}.`
      )
  }
}

/**
 * The environment `next build` is spawned with. Next.js sends anonymous build telemetry (POST to telemetry.nextjs.org — measured:
 * 14 requests per build). A build that is meant to have no external side effect does not send it, unless someone opted in
 * explicitly by setting the variable.
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string | undefined>}
 */
export function nextBuildEnv(env) {
  return { ...env, NEXT_TELEMETRY_DISABLED: env.NEXT_TELEMETRY_DISABLED ?? "1" }
}

function runNextBuild(env, root) {
  const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next")
  return new Promise((resolveExit) => {
    const child = spawn(process.execPath, [nextBin, "build"], { cwd: root, env: nextBuildEnv(env), stdio: "inherit" })
    child.on("exit", (code, signal) => resolveExit(code ?? (signal ? 1 : 0)))
    child.on("error", (error) => {
      console.error("[build] could not start next build:", error.message)
      resolveExit(1)
    })
  })
}

async function main() {
  const root = process.cwd()
  const plan = planBuild(process.env, readBuildEnvFiles(root), { developerMachine: hasDeveloperEnvFiles(root) })
  console.log(describePlan(plan))
  if (plan.mode === "refused") process.exit(2)
  process.exit(await runNextBuild(plan.env, root))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error("[build] failed:", error instanceof Error ? error.message : error)
    process.exit(1)
  })
}

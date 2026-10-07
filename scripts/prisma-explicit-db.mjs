#!/usr/bin/env node
/**
 * Runs `prisma migrate status` / `deploy` / `resolve --rolled-back` against ONE explicit database — never against
 * whatever the repository's .env files happen to say.
 *
 * Why it exists: `prisma.config.ts` loads `.env` / `.env.local` with `override: true`, so
 *   DATABASE_URL="<some url>" npx prisma migrate deploy
 * silently runs against the DEFAULT database (production, on a developer machine). This script bypasses that: it
 * gives Prisma a config that loads no env file, hands it exactly the URL you pass, and checks that Prisma's own output
 * names the endpoint you EXPECT before it writes anything.
 *
 *   DATABASE_URL='<url>' node scripts/prisma-explicit-db.mjs status
 *   DATABASE_URL='<url>' node scripts/prisma-explicit-db.mjs deploy  --expect-endpoint ep-xxxx-yyyy [--confirm-production]
 *   DATABASE_URL='<url>' node scripts/prisma-explicit-db.mjs resolve --rolled-back <migration> --expect-endpoint ep-xxxx-yyyy [--confirm-production]
 *
 * `status` runs in a session the DATABASE SERVER keeps read-only (default_transaction_read_only=on): measured, it sends exactly
 * three SELECTs, and any write would be refused by PostgreSQL itself.
 *
 * Only these three exist on purpose: no free-form Prisma command, no `db push`, no `migrate dev`, and NO
 * `resolve --applied` — recording a failed migration as applied needs a human proof of the schema, never a tool
 * (see docs/DEPLOY-SCHEMA-CHANGES.md). A write on the PRODUCTION branch additionally needs --confirm-production.
 *
 * The primitives (runPrisma, createExplicitConfig, parsers) are exported for scripts/schema-deploy.mjs.
 */
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { parseDatabaseUrl } from "./env-shared.mjs"

const COMMANDS = ["status", "deploy", "resolve"]
const WRITING_COMMANDS = ["deploy", "resolve"]
const ENV_NOISE = /DATABASE|DIRECT_URL|POSTGRES|NEON|^PG(HOST|USER|PASSWORD|DATABASE|PORT)$/i
export const MIGRATION_NAME_RE = /^\d{14}_[a-z0-9_]+$/i

/**
 * @typedef {{ command: string | undefined, expectEndpoint: string, confirmProduction: boolean, rolledBack: string, error?: string }} ParsedArgs
 * @param {string[]} argv
 * @returns {ParsedArgs}
 */
export function parseArgs(argv) {
  const [command, ...rest] = argv
  /** @type {ParsedArgs} */
  const options = { command, expectEndpoint: "", confirmProduction: false, rolledBack: "" }
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--expect-endpoint") options.expectEndpoint = rest[++i] ?? ""
    else if (rest[i] === "--confirm-production") options.confirmProduction = true
    else if (rest[i] === "--rolled-back") options.rolledBack = rest[++i] ?? ""
    else return { ...options, error: `unknown argument "${rest[i]}"` }
  }
  return options
}

/** "ep-misty-sea-al1ne07p-pooler" and "ep-misty-sea-al1ne07p" are the same endpoint. */
export function normalizeEndpoint(value) {
  return String(value ?? "").trim().toLowerCase().replace(/-pooler$/, "")
}

/** The direct (non-pooled) URL Prisma Migrate needs on Neon. */
export function directUrlOf(rawUrl) {
  const url = new URL(rawUrl.trim())
  url.hostname = url.hostname.replace(/-pooler/g, "")
  url.searchParams.delete("pgbouncer")
  url.searchParams.delete("connection_limit")
  if (!url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require")
  if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "60")
  return url.toString()
}

/** The PostgreSQL startup option that makes the SESSION read-only: the server itself then refuses INSERT / UPDATE / DELETE / DDL. */
export const READ_ONLY_SESSION_OPTION = "-c default_transaction_read_only=on"

/**
 * The same URL, with a session the SERVER keeps read-only (SQLSTATE 25006 on any write, `WHERE false` included — measured on the
 * test database, through the Prisma client AND the schema engine). Neon's pooler rejects startup options, so its host is replaced
 * by the direct one. An `options` already present is kept.
 * @param {string} rawUrl
 */
export function withReadOnlySession(rawUrl) {
  const url = new URL(rawUrl.trim())
  url.hostname = url.hostname.replace(/-pooler/g, "")
  const existing = url.searchParams.get("options") ?? ""
  if (!existing.includes(READ_ONLY_SESSION_OPTION)) {
    url.searchParams.set("options", existing ? `${existing} ${READ_ONLY_SESSION_OPTION}` : READ_ONLY_SESSION_OPTION)
  }
  return url.toString()
}

/**
 * The environment Prisma gets: nothing that could name another database survives; exactly the given URL is set.
 * With `readOnly`, all three URLs carry a server-enforced read-only session (used for `status` and the catalog check, so that
 * "read-only" is a property of the database session and not just a belief about the code).
 * @param {Record<string, string | undefined>} processEnv
 * @param {string} rawUrl
 * @param {{ readOnly?: boolean }} [options]
 * @returns {Record<string, string | undefined>}
 */
export function buildChildEnv(processEnv, rawUrl, { readOnly = false } = {}) {
  /** @type {Record<string, string | undefined>} */
  const env = {}
  for (const [key, value] of Object.entries(processEnv)) {
    if (!ENV_NOISE.test(key)) env[key] = value
  }
  const direct = readOnly ? withReadOnlySession(directUrlOf(rawUrl)) : directUrlOf(rawUrl)
  env.DATABASE_URL = readOnly ? direct : rawUrl.trim()
  env.DATABASE_URL_UNPOOLED = direct
  env.DIRECT_URL = direct
  return env
}

/**
 * The name Prisma prints for a database: the Neon endpoint id, or the host for any other server (local, CI).
 * @param {ReturnType<typeof parseDatabaseUrl>} target
 */
export function endpointOf(target) {
  return normalizeEndpoint(target.endpointId || String(target.host ?? "").replace(/:\d+$/, ""))
}

/**
 * Decides, BEFORE anything is run, whether this invocation is allowed.
 * @param {{ command: string | undefined, rawUrl: string | undefined, expectEndpoint: string, confirmProduction: boolean, rolledBack?: string }} input
 * @returns {{ ok: boolean, reason?: string, endpoint?: string, branch?: string, maskedHost?: string }}
 */
export function assessInvocation({ command, rawUrl, expectEndpoint, confirmProduction, rolledBack }) {
  if (!COMMANDS.includes(command ?? "")) return { ok: false, reason: `command must be one of: ${COMMANDS.join(", ")}` }
  if (!rawUrl || !/^postgres(?:ql)?:\/\//i.test(rawUrl.trim())) {
    return { ok: false, reason: "DATABASE_URL must be set in the environment of this command (a postgres URL). .env files are never read." }
  }
  const target = parseDatabaseUrl(rawUrl)
  const endpoint = endpointOf(target)
  if (!endpoint) return { ok: false, reason: "cannot identify the database endpoint from the URL" }
  if (command === "resolve" && !MIGRATION_NAME_RE.test(rolledBack ?? "")) {
    return { ok: false, reason: "resolve needs --rolled-back <migration name> (14 digits + name). There is no --applied: see docs/DEPLOY-SCHEMA-CHANGES.md" }
  }
  if (WRITING_COMMANDS.includes(command ?? "")) {
    if (!expectEndpoint) return { ok: false, reason: `${command} requires --expect-endpoint <ep-id> (say which database you mean to change)` }
    if (normalizeEndpoint(expectEndpoint) !== endpoint) {
      return { ok: false, reason: `--expect-endpoint ${expectEndpoint} does not match the URL's endpoint (${endpoint}). Nothing was run.` }
    }
    if (target.branch === "production" && !confirmProduction) {
      return { ok: false, reason: "this is the PRODUCTION database: re-run with --confirm-production once you have read docs/DEPLOY-SCHEMA-CHANGES.md" }
    }
  }
  return { ok: true, endpoint, branch: target.branch, maskedHost: target.maskedHost }
}

/* ---------------------------------------------------------------------------------------------------------------
 * Reading Prisma's own output. Pure, so the decisions built on it are testable without a database.
 * ------------------------------------------------------------------------------------------------------------- */

const MIGRATION_NAME_IN_TEXT = /(\d{14}_[a-z0-9_]+)/gi

/** Names of the migrations Prisma reports as FAILED (an unfinished row in `_prisma_migrations`). */
export function parseFailedMigrations(text) {
  const names = new Set()
  if (!text) return []
  const block = text.match(/following migrations?(?:\(s\))? have failed:\s*([\s\S]*?)(?:\n\s*\n|During development|To fix|Read more|$)/i)
  if (block?.[1]) for (const m of block[1].matchAll(MIGRATION_NAME_IN_TEXT)) names.add(m[1])
  for (const m of text.matchAll(/`(\d{14}_[a-z0-9_]+)` migration[^\n]*failed/gi)) names.add(m[1])
  if (/P3009/.test(text)) for (const m of text.matchAll(/`(\d{14}_[a-z0-9_]+)`/gi)) names.add(m[1])
  return [...names].sort()
}

/** Names of the migrations Prisma says have not been applied yet. */
export function parsePendingMigrations(text) {
  if (!text || isUpToDate(text)) return []
  const block = text.match(/following migrations? (?:have|has) not yet been applied:\s*([\s\S]*?)(?:\n\s*\n|To apply|$)/i)
  if (!block?.[1]) return []
  return [...new Set([...block[1].matchAll(MIGRATION_NAME_IN_TEXT)].map((m) => m[1]))].sort()
}

export function isUpToDate(text) {
  return /Database schema is up to date/i.test(text ?? "")
}

/** A connection problem that can go away by itself (Neon waking up, a lock held by a concurrent run). */
export function isTransientDbError(text) {
  return /P1001|P1002|P1017|Can't reach database server|Timed out trying to acquire a postgres advisory lock|connection timed out|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(
    text ?? ""
  )
}

export const quiet = (text) =>
  String(text ?? "")
    .split("\n")
    .filter((line) => line.trim() && !/Update available|npm i |major update|^[┌│└]/.test(line))
    .join("\n")

/**
 * A Prisma config that loads NO env file and points at the repository schema. The caller must `cleanup()`.
 * @param {string} cwd
 */
export function createExplicitConfig(cwd) {
  const dir = mkdtempSync(join(tmpdir(), "prisma-explicit-"))
  const configPath = join(dir, "prisma.config.mjs")
  writeFileSync(configPath, `export default { schema: ${JSON.stringify(resolve(cwd, "prisma/schema.prisma"))} }\n`)
  return { configPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

/**
 * @param {string} subcommand status | deploy | resolve
 * @param {Record<string, string | undefined>} env
 * @param {string} configPath
 * @param {string} cwd
 * @param {string[]} [extraArgs]
 * @param {number} [timeoutMs]
 * @returns {{ status: number | null, text: string }}
 */
export function runPrisma(subcommand, env, configPath, cwd, extraArgs = [], timeoutMs = 10 * 60_000) {
  const result = spawnSync("npx", ["prisma", "migrate", subcommand, "--config", configPath, ...extraArgs], {
    cwd,
    env,
    encoding: "utf8",
    timeout: timeoutMs,
  })
  const timedOut = result.error ? `\n${result.error.message}` : ""
  return { status: result.status, text: `${result.stdout ?? ""}\n${result.stderr ?? ""}${timedOut}` }
}

/** @returns {Promise<number>} the process exit code (cleanup always runs before the process exits). */
async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.error) {
    console.error(`✗ ${options.error}`)
    return 2
  }
  const rawUrl = process.env.DATABASE_URL ?? ""
  const verdict = assessInvocation({ ...options, rawUrl })
  if (!verdict.ok) {
    console.error(`✗ ${verdict.reason}`)
    return 2
  }

  const cwd = process.cwd()
  const { configPath, cleanup } = createExplicitConfig(cwd)
  const env = buildChildEnv(process.env, rawUrl)
  const readOnlyEnv = buildChildEnv(process.env, rawUrl, { readOnly: true })

  try {
    // Prove which database Prisma will talk to BEFORE anything is written — in a session the SERVER keeps read-only.
    const status = runPrisma("status", readOnlyEnv, configPath, cwd, [], 3 * 60_000)
    if (!status.text.toLowerCase().includes(verdict.endpoint ?? "")) {
      console.error(`✗ ABORT: Prisma's own output does not name the endpoint ${verdict.endpoint}. Nothing was changed.`)
      return 3
    }
    console.log(`✓ Prisma targets ${verdict.maskedHost} (endpoint ${verdict.endpoint}, branch ${verdict.branch})`)

    if (options.command === "status") {
      console.log(quiet(status.text))
      const failed = parseFailedMigrations(status.text)
      if (failed.length > 0) console.log(`\n✗ FAILED migration(s): ${failed.join(", ")} — see docs/DEPLOY-SCHEMA-CHANGES.md §6`)
      return 0
    }

    if (options.command === "resolve") {
      const failed = parseFailedMigrations(status.text)
      if (!failed.includes(options.rolledBack)) {
        console.error(
          `✗ ${options.rolledBack} is not reported as FAILED by Prisma (failed: ${failed.join(", ") || "none"}). Nothing was changed.`
        )
        return 4
      }
      const resolved = runPrisma("resolve", env, configPath, cwd, ["--rolled-back", options.rolledBack], 3 * 60_000)
      console.log(quiet(resolved.text))
      if (resolved.status !== 0) return resolved.status ?? 1
      console.log(
        "\nRecorded as rolled back — NOTHING was undone in the schema. If the failed run left objects behind, remove them by hand " +
          "(DATABASE_URL='<url>' npm run schema:verify lists what is present) BEFORE re-running npm run schema:migrate."
      )
      return 0
    }

    const deploy = runPrisma("deploy", env, configPath, cwd)
    console.log(quiet(deploy.text))
    if (deploy.status !== 0) return deploy.status ?? 1
    console.log("\nNext: DATABASE_URL='<same url>' npm run schema:verify   (the catalog is the proof, not `migrate status`)")
    return 0
  } finally {
    cleanup()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error("✗ failed:", error instanceof Error ? error.message : error)
      process.exit(1)
    })
}

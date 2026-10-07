import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadEnv } from "dotenv"
import { defineConfig } from "prisma/config"
import { hasDeveloperEnvFiles } from "./scripts/build-isolated.mjs"
import { ensureDirectUrl } from "./scripts/ensure-direct-url.mjs"
import { assessProductionByAccident } from "./scripts/lib/production-guard.mjs"

const root = process.cwd()

/** Prisma 6 + prisma.config.ts: no automatic .env load — merge all local env files. */
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) {
    loadEnv({ path, override: true })
  }
}

ensureDirectUrl()

const prismaCmd = process.argv.join(" ")
const needsDatabaseUrl =
  /migrate|db\s+pull|db\s+push|studio|seed/i.test(prismaCmd) &&
  !/generate|validate|format/i.test(prismaCmd)

/**
 * The commands that CHANGE a database. This config loads `.env` / `.env.local` with `override: true`, so on a developer machine they
 * target whatever those files say — production by default — whatever `DATABASE_URL` the caller passed. Refuse that, unless the caller
 * confirmed the endpoint (AFFISELL_ALLOW_PRODUCTION_WRITES=<ep-id>). `generate`, `validate`, `format`, `migrate status`, `db pull`
 * are not concerned; neither is scripts/prisma-explicit-db.mjs, which uses its own config and an explicit URL.
 */
const WRITES_DATABASE = /\b(db\s+(push|execute|seed)|migrate\s+(deploy|dev|reset|resolve))\b/i
if (WRITES_DATABASE.test(prismaCmd)) {
  const verdict = assessProductionByAccident({
    tool: `prisma ${prismaCmd.match(WRITES_DATABASE)?.[0] ?? "(write command)"}`,
    env: process.env,
    developerMachine: hasDeveloperEnvFiles(root),
  })
  if (!verdict.ok) throw new Error(verdict.reason)
}

if (needsDatabaseUrl && !process.env.DATABASE_URL?.trim()) {
  throw new Error(
    [
      "DATABASE_URL is missing for Prisma CLI.",
      "Fix: copy DATABASE_URL from .env.pre-local-merge.bak into .env, or run:",
      "  node scripts/merge-env-from-backup.mjs",
    ].join("\n")
  )
}

export default defineConfig({
  schema: "prisma/schema.prisma",
})

/**
 * Radar schema (`prisma/radar.schema.prisma`) uses env("RADAR_DATABASE_URL").
 * `npm run radar:db:push` → scripts/radar-db.mjs sets RADAR_DATABASE_URL to:
 *   RADAR_DATABASE_URL | Neon DATABASE_URL_UNPOOLED | DATABASE_URL
 * (skips docker localhost:5434). Tables live in Postgres schema `market_intelli`.
 */
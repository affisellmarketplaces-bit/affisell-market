import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadEnv } from "dotenv"
import { defineConfig } from "prisma/config"
import { ensureDirectUrl } from "./scripts/ensure-direct-url.mjs"

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

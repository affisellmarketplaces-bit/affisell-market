#!/usr/bin/env node
/**
 * Run Prisma CLI with .env / backup / .env.local loaded (same order as prisma.config.ts).
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { config as loadEnv } from "dotenv"

import { ensureDirectUrl } from "./ensure-direct-url.mjs"

const root = resolve(import.meta.dirname, "..")

for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) loadEnv({ path, override: true })
}

ensureDirectUrl()

if (!process.env.DATABASE_URL?.trim()) {
  console.error("DATABASE_URL missing. Run: node scripts/merge-env-from-backup.mjs")
  process.exit(1)
}

const prismaArgs = process.argv.slice(2)
if (prismaArgs.length === 0) {
  console.error("Usage: node scripts/prisma-with-env.mjs <prisma subcommand> [...]")
  process.exit(1)
}

const result = spawnSync("npx", ["prisma", ...prismaArgs], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
})

process.exit(result.status ?? 1)

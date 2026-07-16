#!/usr/bin/env node
/**
 * Radar Prisma CLI with .env / .env.local and MARKET_INTELLI_* → RADAR_* fallback.
 * Usage: node scripts/radar-db.mjs push | studio | generate
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { config as loadEnv } from "dotenv"

const root = resolve(import.meta.dirname, "..")

for (const name of [".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) loadEnv({ path, override: true })
}

if (!process.env.RADAR_DATABASE_URL?.trim() && process.env.MARKET_INTELLI_DATABASE_URL?.trim()) {
  process.env.RADAR_DATABASE_URL = process.env.MARKET_INTELLI_DATABASE_URL.trim()
}

const cmd = process.argv[2] ?? "push"
const schema = "prisma/radar.schema.prisma"

const prismaArgs =
  cmd === "studio"
    ? ["studio", `--schema=${schema}`]
    : cmd === "generate"
      ? ["generate", `--schema=${schema}`]
      : ["db", "push", `--schema=${schema}`]

const result = spawnSync("npx", ["prisma", ...prismaArgs], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
})

process.exit(result.status ?? 1)

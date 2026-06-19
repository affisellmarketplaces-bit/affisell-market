#!/usr/bin/env node
/**
 * If .env lacks DATABASE_URL after renaming .env.local → .env, copy that line from backup.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const envPath = resolve(root, ".env")
const backupPath = resolve(root, ".env.pre-local-merge.bak")

if (!existsSync(envPath)) {
  console.error("Missing .env — restore from .env.local or backup first.")
  process.exit(1)
}

const envText = readFileSync(envPath, "utf8")
if (/^DATABASE_URL\s*=/m.test(envText)) {
  console.log("OK: DATABASE_URL already in .env")
  process.exit(0)
}

if (!existsSync(backupPath)) {
  console.error("DATABASE_URL missing in .env and no .env.pre-local-merge.bak found.")
  process.exit(1)
}

const backup = readFileSync(backupPath, "utf8")
const lines = backup.split("\n").filter((l) => /^(DATABASE_URL|DATABASE_URL_UNPOOLED|DIRECT_URL)\s*=/.test(l))
if (lines.length === 0) {
  console.error("No DATABASE_URL in backup file.")
  process.exit(1)
}

const merged = `${envText.trimEnd()}\n${lines.join("\n")}\n`
writeFileSync(envPath, merged, "utf8")
console.log(`Merged ${lines.length} line(s) from .env.pre-local-merge.bak into .env`)

#!/usr/bin/env node
/**
 * Append Neon pooler params to DATABASE_URL in .env (and .env.local if present).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
/** Align with lib/prisma-datasource-url.ts defaults (dev 15 conns, 30s pool wait). */
const PARAMS = [
  "pgbouncer=true",
  "connection_limit=15",
  "pool_timeout=30",
  "connect_timeout=15",
]

function patchFile(filePath) {
  if (!existsSync(filePath)) return false
  let text = readFileSync(filePath, "utf8")
  const lines = text.split("\n")
  let changed = false

  const out = lines.map((line) => {
    if (!line.startsWith("DATABASE_URL=")) return line
    let value = line.slice("DATABASE_URL=".length).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    try {
      const url = new URL(value)
      for (const p of PARAMS) {
        const [k, v] = p.split("=")
        if (!url.searchParams.has(k)) {
          url.searchParams.set(k, v)
          changed = true
        }
      }
      return `DATABASE_URL="${url.toString()}"`
    } catch {
      console.warn(`Skip invalid DATABASE_URL in ${filePath}`)
      return line
    }
  })

  if (changed) {
    writeFileSync(filePath, out.join("\n"), "utf8")
    console.log(`Patched ${filePath}`)
  }
  return changed
}

let any = false
for (const name of [".env", ".env.local"]) {
  if (patchFile(resolve(root, name))) any = true
}
if (!any) console.log("DATABASE_URL already has pool params or file missing.")

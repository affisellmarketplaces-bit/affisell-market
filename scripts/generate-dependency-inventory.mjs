#!/usr/bin/env node
/**
 * Writes lib/strategic-intelligence/external/dependency-inventory.json: every PRODUCTION package (name + exact version)
 * of package-lock.json — what Vercel installs (`npm ci`), dev-only packages excluded (same scope as
 * `npm audit --omit=dev`). The intelligence cockpit checks these exact versions against OSV.dev.
 *
 * Run after any dependency change:  node scripts/generate-dependency-inventory.mjs
 * lib/__tests__/dependency-inventory.test.ts fails when the file no longer matches the lockfile.
 * Reads and writes local files only; no network, no database.
 */
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export function buildDependencyInventory(lockText) {
  const lock = JSON.parse(lockText)
  const seen = new Set()
  const packages = []
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    if (!key.includes("node_modules/")) continue
    if (!entry || entry.dev || entry.devOptional || entry.link || typeof entry.version !== "string") continue
    const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length)
    const id = `${name}@${entry.version}`
    if (seen.has(id)) continue
    seen.add(id)
    packages.push([name, entry.version])
  }
  packages.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])))
  return { source: "package-lock.json (production dependencies, npm ci)", count: packages.length, packages }
}

/** One package per line: readable diffs when a dependency moves. */
export function serializeDependencyInventory(inv) {
  const rows = inv.packages.map((p) => `  ${JSON.stringify(p)}`).join(",\n")
  return `{\n "source": ${JSON.stringify(inv.source)},\n "count": ${inv.count},\n "packages": [\n${rows}\n ]\n}\n`
}

export const INVENTORY_PATH = "lib/strategic-intelligence/external/dependency-inventory.json"

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inv = buildDependencyInventory(readFileSync("package-lock.json", "utf8"))
  writeFileSync(INVENTORY_PATH, serializeDependencyInventory(inv))
  console.log(`dependency inventory: ${inv.count} production packages → ${INVENTORY_PATH}`)
}

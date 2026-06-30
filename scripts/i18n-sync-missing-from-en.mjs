#!/usr/bin/env node
/**
 * Sync all locale bundles to EN key parity: keep existing translations,
 * fill missing keys from en.json, drop keys not present in EN.
 *
 * Usage: node scripts/i18n-sync-missing-from-en.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const en = JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf8"))

function syncToCanonical(target, canonical) {
  if (!canonical || typeof canonical !== "object" || Array.isArray(canonical)) {
    return target !== undefined ? target : canonical
  }
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [key, value] of Object.entries(canonical)) {
    const existing = target?.[key]
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const child =
        existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {}
      out[key] = syncToCanonical(child, value)
    } else {
      out[key] = typeof existing === "string" ? existing : value
    }
  }
  return out
}

const locales = fs
  .readdirSync(path.join(root, "messages"))
  .filter((f) => f.endsWith(".json") && f !== "en.json")

for (const file of locales) {
  const filePath = path.join(root, "messages", file)
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"))
  const synced = syncToCanonical(data, en)
  fs.writeFileSync(filePath, `${JSON.stringify(synced, null, 2)}\n`)
  console.log(`[i18n-sync-missing] ${file}`)
}

console.log("[i18n-sync-missing] done — run npm run i18n:parity to verify")

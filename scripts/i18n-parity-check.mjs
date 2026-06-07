#!/usr/bin/env node
/** Compare message key paths between EN canonical and other locale bundles. */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"))
}

function messageKeys(obj, prefix = "") {
  const keys = []
  for (const [key, value] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...messageKeys(value, p))
    } else {
      keys.push(p)
    }
  }
  return keys
}

const en = loadJson("messages/en.json")
const enKeys = new Set(messageKeys(en))

const locales = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["fr", "de", "es", "it", "nl", "pl", "zh"]

let failed = false

for (const locale of locales) {
  const file = locale === "fr" ? "messages/fr.json" : `messages/${locale}.json`
  const fullPath = path.join(root, file)
  if (!fs.existsSync(fullPath)) {
    console.log(`[i18n-parity] ${locale}: MISSING ${file}`)
    failed = true
    continue
  }
  const bundle = loadJson(file)
  const keys = new Set(messageKeys(bundle))
  const missing = [...enKeys].filter((k) => !keys.has(k))
  const extra = [...keys].filter((k) => !enKeys.has(k))
  const pct = Math.round((100 * keys.size) / enKeys.size)
  if (missing.length === 0 && extra.length === 0) {
    console.log(`[i18n-parity] ${locale}: OK (${keys.size} keys, 100%)`)
  } else {
    failed = true
    console.log(
      `[i18n-parity] ${locale}: FAIL ${pct}% — missing ${missing.length}, extra ${extra.length}`
    )
    if (missing.length) console.log(`  missing sample: ${missing.slice(0, 5).join(", ")}`)
    if (extra.length) console.log(`  extra sample: ${extra.slice(0, 5).join(", ")}`)
  }
}

process.exit(failed ? 1 : 0)

#!/usr/bin/env node
/**
 * Sync Phase 13 booking keys (waitlist SMS + buyer iCal) from en.json into other locales.
 * Usage: node scripts/i18n-sync-booking-phase13.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const en = JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf8"))

const KEYS = {
  BookingPass: en.BookingPass,
  Product: { booking: en.Product.booking },
}

function deepMergeMissing(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return target
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {}
      deepMergeMissing(target[key], value)
    } else if (target[key] === undefined) {
      target[key] = value
    }
  }
  return target
}

const locales = fs
  .readdirSync(path.join(root, "messages"))
  .filter((f) => f.endsWith(".json") && f !== "en.json")

for (const file of locales) {
  const filePath = path.join(root, "messages", file)
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"))
  deepMergeMissing(data, KEYS)
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`[i18n] synced ${file}`)
}

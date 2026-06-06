#!/usr/bin/env node
/**
 * Build a full messages/{locale}.json from messages/en.json via Groq.
 * Usage: GROQ_API_KEY=… node scripts/i18n-translate-locale.mjs --locale=de
 *        node scripts/i18n-translate-locale.mjs --all
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import Groq from "groq-sdk"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const en = JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf8"))

const LOCALE_NAMES = {
  de: "German (Deutsch)",
  es: "Spanish (Español)",
  it: "Italian (Italiano)",
  nl: "Dutch (Nederlands)",
  pl: "Polish (Polski)",
}

const MAX_LEAVES_PER_BATCH = 35

function flattenLeaves(obj, prefix = "") {
  /** @type {Record<string, string>} */
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flattenLeaves(value, p))
    } else if (typeof value === "string") {
      out[p] = value
    }
  }
  return out
}

function unflattenLeaves(flat) {
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [pathKey, value] of Object.entries(flat)) {
    const parts = pathKey.split(".")
    let cur = out
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!cur[part] || typeof cur[part] !== "object") cur[part] = {}
      cur = cur[part]
    }
    cur[parts[parts.length - 1]] = value
  }
  return out
}

function chunkObject(obj, size) {
  const entries = Object.entries(obj)
  /** @type {Record<string, string>[]} */
  const chunks = []
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(Object.fromEntries(entries.slice(i, i + size)))
  }
  return chunks
}

async function translateBatch(groq, flatBatch, langLabel) {
  const prompt = `You are a professional UI translator for Affisell, a European creator marketplace.

Translate every string VALUE to ${langLabel}. Return a single JSON object with the EXACT same keys.

Rules:
- Do NOT translate brand names: Affisell, Stripe, PayPal, Google, AliExpress, EU, ODR, WCAG, Shopify, Amazon, Metabase, Sentry, Vercel, Groq, Notion, Discord, TikTok, Instagram, YouTube, Twitch
- Keep ICU placeholders unchanged: {count}, {name}, {price}, {year}, {email}, {pct}, {since}, {compact}, {euCount}, etc.
- Keep plural/select ICU syntax: {count, plural, one {# item} other {# items}}
- Keep HTML entities and markdown as-is
- Keep emoji unchanged
- Use natural, concise marketplace UI tone

Input JSON:
${JSON.stringify(flatBatch, null, 2)}`

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 8192,
  })

  const raw = completion.choices[0]?.message?.content?.trim()
  if (!raw) throw new Error("empty_groq_response")

  const parsed = JSON.parse(raw)
  for (const key of Object.keys(flatBatch)) {
    if (typeof parsed[key] !== "string") {
      throw new Error(`missing_or_invalid_key:${key}`)
    }
  }
  return parsed
}

async function translateNamespace(groq, namespace, enSubtree, langLabel) {
  const flat = flattenLeaves(enSubtree, namespace)
  const chunks = chunkObject(flat, MAX_LEAVES_PER_BATCH)
  /** @type {Record<string, string>} */
  const merged = {}

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[i18n-translate]   ${namespace} batch ${i + 1}/${chunks.length}`)
    const translated = await translateBatch(groq, chunks[i], langLabel)
    Object.assign(merged, translated)
    await new Promise((r) => setTimeout(r, 400))
  }

  return unflattenLeaves(merged)[namespace]
}

async function translateLocale(locale) {
  const langLabel = LOCALE_NAMES[locale]
  if (!langLabel) throw new Error(`unsupported_locale:${locale}`)

  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) throw new Error("GROQ_API_KEY required")

  const groq = new Groq({ apiKey })
  const target = path.join(root, "messages", `${locale}.json`)
  /** @type {Record<string, unknown>} */
  const out = fs.existsSync(target)
    ? JSON.parse(fs.readFileSync(target, "utf8"))
    : {}

  const namespaces = Object.keys(en)
  console.log(`[i18n-translate] ${locale} (${langLabel}) — ${namespaces.length} namespaces`)

  for (const ns of namespaces) {
    if (out[ns] != null) {
      console.log(`[i18n-translate] skip ${ns} (already present)`)
      continue
    }
    console.log(`[i18n-translate] → ${ns}`)
    out[ns] = await translateNamespace(groq, ns, en[ns], langLabel)
    fs.writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`, "utf8")
  }

  console.log(`[i18n-translate] wrote ${target}`)
}

const argLocale = process.argv.find((a) => a.startsWith("--locale="))?.split("=")[1]
const runAll = process.argv.includes("--all")

async function main() {
  if (runAll) {
    for (const locale of Object.keys(LOCALE_NAMES)) {
      await translateLocale(locale)
    }
    return
  }
  if (!argLocale) {
    console.error("Usage: node scripts/i18n-translate-locale.mjs --locale=de | --all")
    process.exit(1)
  }
  await translateLocale(argLocale)
}

main().catch((e) => {
  console.error("[i18n-translate] failed", e)
  process.exit(1)
})

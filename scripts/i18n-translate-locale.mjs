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
  zh: "Simplified Chinese (简体中文)",
}

const MAX_LEAVES_PER_BATCH = Number(process.env.GROQ_I18N_BATCH_SIZE) || 35

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

const GROQ_MODEL = process.env.GROQ_I18N_MODEL?.trim() || "llama-3.3-70b-versatile"
const MAX_RATE_LIMIT_RETRIES = 12
const MAX_BATCH_RETRIES = 3

function parseRetryAfterSeconds(err) {
  const header = err?.headers?.get?.("retry-after")
  if (header) {
    const n = Number(header)
    if (Number.isFinite(n) && n > 0) return Math.ceil(n)
  }
  const msg = err?.error?.error?.message ?? err?.message ?? ""
  const match = msg.match(/try again in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i)
  if (match) {
    const h = Number(match[1] || 0)
    const m = Number(match[2] || 0)
    const s = Number(match[3] || 0)
    return Math.ceil(h * 3600 + m * 60 + s)
  }
  return 120
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
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

  for (let batchAttempt = 0; batchAttempt < MAX_BATCH_RETRIES; batchAttempt++) {
    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
      try {
        const completion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: Math.min(
            8192,
            Math.max(1024, Object.keys(flatBatch).length * 220 + JSON.stringify(flatBatch).length),
          ),
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
      } catch (err) {
        const is429 = err?.status === 429 || err?.error?.error?.code === "rate_limit_exceeded"
        const is413 = err?.status === 413
        const isJsonFail = err?.status === 400 && err?.error?.error?.code === "json_validate_failed"
        if (is413) throw err
        if (!is429 || attempt === MAX_RATE_LIMIT_RETRIES) {
          const retryable =
            isJsonFail ||
            err instanceof SyntaxError ||
            (err instanceof Error && err.message.startsWith("missing_or_invalid_key:"))
          if (retryable && batchAttempt < MAX_BATCH_RETRIES - 1) {
            console.log(
              `[i18n-translate] batch incomplete (${isJsonFail ? "json_validate_failed" : err instanceof Error ? err.message : "parse_error"}), retry ${batchAttempt + 2}/${MAX_BATCH_RETRIES}`,
            )
            await sleep(800)
            break
          }
          throw err
        }
        const waitSec = parseRetryAfterSeconds(err)
        console.log(
          `[i18n-translate] rate limited (${GROQ_MODEL}), waiting ${waitSec}s (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`,
        )
        await sleep(waitSec * 1000)
      }
    }
  }

  throw new Error("batch_retries_exhausted")
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
    await sleep(400)
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

#!/usr/bin/env node
/**
 * Probe BytePlus ModelArk models (minimal request per type).
 *
 * Usage:
 *   BYTEPLUS_API_KEY=... BYTEPLUS_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3 \
 *     node scripts/test-byteplus-11.js
 *
 *   BYTEPLUS_API_KEY=ark-... \
 *   BYTEPLUS_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3 \
 *   BYTEPLUS_ONLY=dola-seed-2-0-mini,bytedance-seed-translation-250615 node scripts/test-byteplus-11.js
 */
"use strict"

const { readFileSync, existsSync } = require("node:fs")
const { resolve } = require("node:path")

function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const raw = readFileSync(filePath, "utf8")
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotEnvFile(resolve(process.cwd(), ".env.local"))
loadDotEnvFile(resolve(process.cwd(), ".env"))

const BASE_URL = (
  process.env.BYTEPLUS_BASE_URL?.trim() ||
  "https://ark.ap-southeast.bytepluses.com/api/v3"
).replace(/\/$/, "")

const API_KEY = (process.env.BYTEPLUS_API_KEY ?? process.env.ARK_API_KEY)?.trim()

const SAMPLE_IMAGE =
  "https://ark-doc.tos-ap-southeast-1.bytepluses.com/seededit_i2i.jpeg"

/** @type {ReadonlyArray<{ id: string; kind: "chat" | "image" | "image-i2i" | "video"; tags?: string[] }>} */
const ALL_MODELS = [
  { id: "skylark-vision-250515", kind: "chat", tags: ["llm", "vision"] },
  { id: "bytedance-seedream-4-5-250902", kind: "image", tags: ["image"] },
  { id: "bytedance-seedream-4-0-250528", kind: "image", tags: ["image"] },
  { id: "dola-seedream-5-0-lite", kind: "image", tags: ["image"] },
  { id: "bytedance-seededit-3-0-i2i-250628", kind: "image-i2i", tags: ["image"] },
  { id: "bytedance-seedance-1-0-lite-i2v-250428", kind: "video", tags: ["video"] },
  { id: "dreamina-seedance-2-0-250528", kind: "video", tags: ["video"] },
  { id: "dreamina-seedance-2-0-fast-250628", kind: "video", tags: ["video"] },
  { id: "dola-seed-2-0-mini", kind: "chat", tags: ["llm"] },
  { id: "dola-seed-2-0-pro-250902", kind: "chat", tags: ["llm"] },
  { id: "bytedance-seed-translation-250615", kind: "chat", tags: ["llm", "translation"] },
]

function resolveModels() {
  const only = process.env.BYTEPLUS_ONLY?.trim()
  if (!only) return ALL_MODELS
  const tokens = only.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
  return ALL_MODELS.filter((m) => {
    const id = m.id.toLowerCase()
    return tokens.some(
      (t) =>
        id === t ||
        id.includes(t) ||
        (t === "llm" && m.kind === "chat") ||
        (t === "image" && (m.kind === "image" || m.kind === "image-i2i")) ||
        (t === "video" && m.kind === "video") ||
        (m.tags ?? []).includes(t)
    )
  })
}

if (!API_KEY) {
  console.error("[test-byteplus-11] Missing BYTEPLUS_API_KEY or ARK_API_KEY")
  process.exit(1)
}

/**
 * @param {unknown} body
 */
function extractError(body) {
  if (!body || typeof body !== "object") return String(body ?? "")
  const record = /** @type {Record<string, unknown>} */ (body)
  const err = record.error
  if (err && typeof err === "object") {
    const e = /** @type {Record<string, unknown>} */ (err)
    const parts = [
      typeof e.code === "string" ? e.code : "",
      typeof e.message === "string" ? e.message : "",
      typeof e.param === "string" ? e.param : "",
    ].filter(Boolean)
    if (parts.length) return parts.join(" — ")
  }
  if (typeof record.message === "string") return record.message
  try {
    return JSON.stringify(body)
  } catch {
    return "Unknown error"
  }
}

/**
 * @param {string} path
 * @param {unknown} payload
 * @param {number} timeoutMs
 */
async function post(path, payload, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const text = await res.text()
    let body = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = { raw: text }
    }
    return { status: res.status, body }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { status: 0, body: { error: { message } } }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {{ id: string; kind: string }} model
 */
async function probe(model) {
  let result

  switch (model.kind) {
    case "chat":
      result = await post(
        "/chat/completions",
        {
          model: model.id,
          messages: [{ role: "user", content: "test" }],
          max_tokens: 8,
        },
        60_000
      )
      break
    case "image":
      result = await post(
        "/images/generations",
        {
          model: model.id,
          prompt: "a red sneaker product photo",
          size: "1024x1024",
          response_format: "url",
          sequential_image_generation: "disabled",
          watermark: false,
        },
        120_000
      )
      break
    case "image-i2i":
      result = await post(
        "/images/generations",
        {
          model: model.id,
          prompt: "a red sneaker product photo",
          image: SAMPLE_IMAGE,
          size: "adaptive",
          response_format: "url",
          watermark: false,
        },
        120_000
      )
      break
    case "video":
      result = await post(
        "/videos/generations",
        {
          model: model.id,
          prompt: "product rotating 360",
        },
        60_000
      )
      break
    default:
      result = { status: 0, body: { error: { message: `Unknown kind: ${model.kind}` } } }
  }

  const ok = result.status >= 200 && result.status < 300
  let detail = ok ? "OK" : extractError(result.body)
  let generated = ""
  if (ok && model.kind === "chat") {
    const body = /** @type {{ choices?: Array<{ message?: { content?: string } }> }} */ (result.body)
    generated = body.choices?.[0]?.message?.content?.trim() ?? ""
    if (generated) detail = `OK — "${generated.slice(0, 120)}${generated.length > 120 ? "…" : ""}"`
  }

  console.log(`${model.id} → ${result.status || "network"} → ${detail}`)

  return {
    model: model.id,
    status: result.status,
    result: ok ? "OK" : detail,
    generated,
  }
}

async function pingAuth() {
  const pingBase = BASE_URL.replace(/\/api\/v3$/, "")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(`${pingBase}/ping`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: controller.signal,
    })
    const text = await res.text()
    let body = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = { raw: text }
    }
    return { status: res.status, body }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { status: 0, body: { error: { message } } }
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  const MODELS = resolveModels()
  if (MODELS.length === 0) {
    console.error("[test-byteplus-11] BYTEPLUS_ONLY matched no models")
    process.exit(1)
  }

  console.log(`[test-byteplus-11] BASE_URL=${BASE_URL}`)
  console.log(`[test-byteplus-11] Probing ${MODELS.length} model(s)\n`)

  const ping = await pingAuth()
  if (ping.status !== 200) {
    const msg = extractError(ping.body)
    console.error(`[test-byteplus-11] Auth preflight failed (${ping.status || "network"}): ${msg}`)
    console.error(
      "[test-byteplus-11] Vérifiez région + clé (clé US → BASE_URL US, clé AP → BASE_URL AP)."
    )
    process.exit(1)
  }
  console.log("[test-byteplus-11] Auth preflight OK\n")

  /** @type {Array<{ model: string; status: number; result: string }>} */
  const rows = []
  for (const model of MODELS) {
    rows.push(await probe(model))
  }

  console.log("\n## Résultats BytePlus\n")
  console.log("| Modèle | HTTP | Résultat |")
  console.log("|--------|------|----------|")
  for (const row of rows) {
    const safe = row.result.replace(/\|/g, "\\|").replace(/\n/g, " ")
    console.log(`| ${row.model} | ${row.status || "—"} | ${safe} |`)
  }

  const okCount = rows.filter((r) => r.result === "OK").length
  console.log(`\n[test-byteplus-11] ${okCount}/${rows.length} OK`)
}

main().catch((err) => {
  console.error("[test-byteplus-11] Fatal:", err)
  process.exit(1)
})

#!/usr/bin/env node
/**
 * Probe BytePlus ModelArk models with the current API key (no console activation).
 *
 * Usage:
 *   BYTEPLUS_API_KEY=your-key node scripts/test-byteplus.js
 *   # or ARK_API_KEY (alias used in BytePlus docs)
 *
 * Optional env:
 *   BYTEPLUS_BASE_URL — default https://ark.ap-southeast.bytepluses.com/api/v3
 *   (region ap-southeast-1; hostname has no "-1" suffix per BytePlus docs)
 */
"use strict"

const { readFileSync, existsSync } = require("node:fs")
const { resolve } = require("node:path")

const BASE_URL =
  process.env.BYTEPLUS_BASE_URL?.trim() ||
  "https://ark.ap-southeast.bytepluses.com/api/v3"
const SAMPLE_IMAGE =
  "https://ark-doc.tos-ap-southeast-1.bytepluses.com/seededit_i2i.jpeg"
const SAMPLE_FIRST_FRAME =
  "https://ark-project.tos-cn-beijing.volces.com/doc_image/i2v_foxrgirl.png"

/** @type {ReadonlyArray<{ id: string; kind: "chat" | "image" | "image-i2i" | "video" | "video-i2v"; prompt: string }>} */
const MODELS = [
  { id: "dola-seed-2-0-pro-250902", kind: "chat", prompt: "test" },
  { id: "skylark-vision", kind: "chat", prompt: "test" },
  { id: "bytedance-seedream-4.5", kind: "image", prompt: "a red shoe" },
  { id: "bytedance-seedream-4.0", kind: "image", prompt: "a red shoe" },
  { id: "dola-seedream-5.0-lite", kind: "image", prompt: "a red shoe" },
  { id: "bytedance-seededit-3.0-i2i", kind: "image-i2i", prompt: "a red shoe" },
  { id: "bytedance-seedance-1.0-lite-i2v", kind: "video-i2v", prompt: "product rotating" },
  { id: "dreamina-seedance-2.0", kind: "video", prompt: "product rotating" },
  { id: "dreamina-seedance-2.0-fast", kind: "video", prompt: "product rotating" },
  { id: "bytedance-seed-translation", kind: "chat", prompt: "test" },
]

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

const apiKey = (process.env.BYTEPLUS_API_KEY ?? process.env.ARK_API_KEY)?.trim()
if (!apiKey) {
  console.error("[test-byteplus] Missing BYTEPLUS_API_KEY (or ARK_API_KEY)")
  process.exit(1)
}

/**
 * @param {unknown} body
 */
function extractErrorMessage(body) {
  if (!body || typeof body !== "object") return String(body ?? "")
  const record = /** @type {Record<string, unknown>} */ (body)
  const err = record.error
  if (err && typeof err === "object") {
    const e = /** @type {Record<string, unknown>} */ (err)
    const code = typeof e.code === "string" ? e.code : ""
    const message = typeof e.message === "string" ? e.message : ""
    const param = typeof e.param === "string" ? e.param : ""
    return [code, message, param].filter(Boolean).join(" — ")
  }
  if (typeof record.message === "string") return record.message
  try {
    return JSON.stringify(body)
  } catch {
    return "Unknown error"
  }
}

/**
 * @param {string} message
 */
function classifyStatus(httpStatus, message) {
  const lower = message.toLowerCase()
  if (
    lower.includes("model not activated") ||
    lower.includes("not activated") ||
    lower.includes("insufficient balance") ||
    lower.includes("insufficient quota") ||
    lower.includes("no permission") ||
    lower.includes("access denied")
  ) {
    return "BLOQUÉ"
  }
  if (httpStatus >= 200 && httpStatus < 300) return "SUCCESS"
  return "FAIL"
}

/**
 * @param {string} path
 * @param {unknown} body
 * @param {number} timeoutMs
 */
async function postJson(path, body, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text()
    let parsed = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = { raw: text }
    }
    return { status: res.status, body: parsed }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { status: 0, body: { error: { message } } }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {{ id: string; kind: string; prompt: string }} model
 */
async function probeModel(model) {
  const label = `[test-byteplus] ${model.id}`
  let result

  switch (model.kind) {
    case "chat":
      result = await postJson(
        "/chat/completions",
        {
          model: model.id,
          messages: [{ role: "user", content: model.prompt }],
          max_tokens: 8,
        },
        45_000
      )
      break
    case "image":
      result = await postJson(
        "/images/generations",
        {
          model: model.id,
          prompt: model.prompt,
          size: "1024x1024",
          response_format: "url",
          sequential_image_generation: "disabled",
          watermark: false,
        },
        90_000
      )
      break
    case "image-i2i":
      result = await postJson(
        "/images/generations",
        {
          model: model.id,
          prompt: model.prompt,
          image: SAMPLE_IMAGE,
          size: "adaptive",
          response_format: "url",
          watermark: false,
        },
        90_000
      )
      break
    case "video":
      result = await postJson(
        "/contents/generations/tasks",
        {
          model: model.id,
          content: [{ type: "text", text: model.prompt }],
          ratio: "16:9",
          duration: 2,
          watermark: false,
        },
        60_000
      )
      break
    case "video-i2v":
      result = await postJson(
        "/contents/generations/tasks",
        {
          model: model.id,
          content: [
            { type: "text", text: model.prompt },
            { type: "image_url", image_url: { url: SAMPLE_FIRST_FRAME } },
          ],
          ratio: "16:9",
          duration: 2,
          watermark: false,
        },
        60_000
      )
      break
    default:
      result = { status: 0, body: { error: { message: `Unknown kind: ${model.kind}` } } }
  }

  const errorMessage = extractErrorMessage(result.body)
  const status = classifyStatus(result.status, errorMessage)

  if (status === "SUCCESS") {
    console.log(`${label} → SUCCESS (${result.status})`)
  } else {
    console.log(`${label} → ${status} (${result.status || "network"}) ${errorMessage}`)
  }

  return {
    model: model.id,
    httpStatus: result.status,
    status,
    error: status === "SUCCESS" ? "" : errorMessage,
  }
}

async function pingAuth() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(`${BASE_URL.replace(/\/api\/v3$/, "")}/ping`, {
      headers: { Authorization: `Bearer ${apiKey}` },
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
  console.log(`[test-byteplus] Base URL: ${BASE_URL}`)
  console.log(`[test-byteplus] Region ap-southeast-1 — ${MODELS.length} models\n`)

  const ping = await pingAuth()
  if (ping.status !== 200) {
    const msg = extractErrorMessage(ping.body)
    console.error(`[test-byteplus] Auth preflight failed (${ping.status || "network"}): ${msg}`)
    console.error(
      "[test-byteplus] Vérifiez la clé (console → API Key Management, région ap-southeast-1) et l'URL de base."
    )
    process.exit(1)
  }
  console.log("[test-byteplus] Auth preflight OK\n")

  /** @type {Array<{ model: string; httpStatus: number; status: string; error: string }>} */
  const rows = []
  for (const model of MODELS) {
    rows.push(await probeModel(model))
  }

  const modelWidth = Math.max("Modèle".length, ...rows.map((r) => r.model.length))
  const statusWidth = Math.max("Statut".length, ...rows.map((r) => r.status.length))

  console.log("\n| Modèle | Statut | Erreur |")
  console.log(`|${"-".repeat(modelWidth + 2)}|${"-".repeat(statusWidth + 2)}|--------|`)
  for (const row of rows) {
    const err = row.error.length > 120 ? `${row.error.slice(0, 117)}...` : row.error
    console.log(`| ${row.model.padEnd(modelWidth)} | ${row.status.padEnd(statusWidth)} | ${err || "—"} |`)
  }

  const ok = rows.filter((r) => r.status === "SUCCESS").length
  const blocked = rows.filter((r) => r.status === "BLOQUÉ").length
  const failed = rows.filter((r) => r.status === "FAIL").length
  console.log(`\n[test-byteplus] Résumé: ${ok} SUCCESS, ${blocked} BLOQUÉ, ${failed} FAIL`)
}

main().catch((err) => {
  console.error("[test-byteplus] Fatal:", err)
  process.exit(1)
})

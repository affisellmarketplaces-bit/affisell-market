#!/usr/bin/env node
/**
 * Hard check — InstantScan env (no server-only imports).
 * Usage: npm run verify:instantscan [-- --live]
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"

function loadEnvFile(name) {
  const path = resolve(process.cwd(), name)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i <= 0) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvFile(".env")
loadEnvFile(".env.local")

const live = process.argv.includes("--live")
const checks = []

function ok(label, pass, detail = "") {
  checks.push({ label, pass, detail })
  console.log(`[verify:instantscan] ${mark(pass)} ${label}${detail ? ` — ${detail}` : ""}`)
}

function mark(pass) {
  return pass ? "✓" : "✗"
}

function isTruthyFlag(name) {
  const v = process.env[name]?.trim().toLowerCase()
  return v === "1" || v === "true"
}

ok(
  "ENABLE_INSTANTSCAN or ENABLE_AI_VISION_V2",
  isTruthyFlag("ENABLE_INSTANTSCAN") || isTruthyFlag("ENABLE_AI_VISION_V2"),
  `INSTANTSCAN=${process.env.ENABLE_INSTANTSCAN?.trim() || "(unset)"} V2=${process.env.ENABLE_AI_VISION_V2?.trim() || "(unset)"}`
)

const openaiKey = process.env.OPENAI_API_KEY?.trim()
ok("OPENAI_API_KEY", Boolean(openaiKey), openaiKey ? `${openaiKey.slice(0, 7)}…` : "missing")

const model = process.env.PRODUCT_VISION_V2_MODEL?.trim() || "gpt-4o"
const badModel = /gpt-4o-\d{4}-\d{2}-\d{2}/i.test(model)
const resolvedModel = badModel ? "gpt-4o" : model
if (badModel) {
  console.log(
    `[verify:instantscan] warn PRODUCT_VISION_V2_MODEL=${model} — runtime fallback → gpt-4o (update .env / Vercel)`
  )
}
ok("PRODUCT_VISION_V2_MODEL resolves", resolvedModel === "gpt-4o" || !badModel, resolvedModel)

if (live && openaiKey) {
  const vitest = spawnSync(
    "npx",
    ["vitest", "run", "lib/__tests__/instantscan-hard-check.test.ts"],
    { stdio: "inherit", env: process.env, cwd: process.cwd() }
  )
  ok("vitest instantscan-hard-check", vitest.status === 0)
} else if (live) {
  console.log("[verify:instantscan] skip live tests (no OPENAI_API_KEY)")
}

const failed = checks.filter((c) => !c.pass)
if (failed.length > 0) {
  console.error(`[verify:instantscan] FAILED (${failed.length} check(s))`)
  process.exit(1)
}
console.log("[verify:instantscan] OK")

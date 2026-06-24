#!/usr/bin/env node
/**
 * Zero-click Medusa + Try-On bootstrap:
 * install → env → migrate → admin → server → API key → sales channel → seed → health
 */
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn, spawnSync } from "node:child_process"
import { config as loadEnv } from "dotenv"
import pg from "pg"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const envPath = resolve(root, ".env")
const envGeneratedPath = resolve(root, ".env.generated")
const logPath = resolve(root, ".setup-auto.log")

const ADMIN_EMAIL = "admin@affisell.com"
const ADMIN_PASSWORD = "Affisell2026!"
const API_KEY_TITLE = "affisell-storefront"
const PRODUCT_HANDLE = "leggings-demo"
const DEFAULT_GARMENT_URL =
  "https://example.blob.vercel-storage.com/flatlay-test.png"
const BASE_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"
const REQUIRED_ENV = [
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "COOKIE_SECRET",
  "STORE_CORS",
  "ADMIN_CORS",
]

const { Client } = pg

function log(step, msg, extra) {
  const line = `[setup-auto] ${step}: ${msg}`
  console.log(line, extra ?? "")
}

function fail(step, msg) {
  console.error(`[setup-auto] ❌ ${step}: ${msg}`)
  process.exit(1)
}

function loadDotenv() {
  if (!existsSync(envPath)) {
    fail("env", "medusa-backend/.env missing — copy 6 vars from ../.env.local")
  }
  loadEnv({ path: envPath, override: true })
  const parentEnv = resolve(root, "..", ".env.local")
  if (existsSync(parentEnv)) {
    loadEnv({ path: parentEnv, override: false })
  }
}

function validateEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]?.trim())
  if (missing.length) {
    console.error("[setup-auto] ❌ Missing in medusa-backend/.env:")
    for (const k of missing) console.error(`  - ${k}`)
    process.exit(1)
  }
  log("env", "OK — all 6 vars present")
}

function runMedusa(args, opts = {}) {
  return spawnSync("node", [resolve(root, "scripts/with-env.mjs"), ...args], {
    cwd: root,
    stdio: opts.inherit ? "inherit" : "pipe",
    encoding: "utf8",
    env: process.env,
  })
}

function ensureInstall() {
  const medusaBin = resolve(root, "node_modules/.bin/medusa")
  if (existsSync(medusaBin)) {
    log("install", "node_modules/.bin/medusa exists — skip npm install")
    return
  }
  log("install", "running npm install --legacy-peer-deps …")
  const r = spawnSync("npm", ["install", "--legacy-peer-deps"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  })
  if (r.status !== 0) fail("install", "npm install failed")
  if (!existsSync(medusaBin)) fail("install", "medusa binary still missing after install")
  log("install", "OK")
}

async function verifyProductTryOnTable() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'product_try_on'`
    )
    if (rows.length === 0) {
      fail("db", "table product_try_on not found after migrate")
    }
    log("db", "product_try_on table exists")
  } finally {
    await client.end()
  }
}

function dbMigrate() {
  log("db", "running medusa db:migrate …")
  const r = runMedusa(["db:migrate"], { inherit: true })
  if (r.status !== 0) fail("db", "db:migrate failed")
}

function seedRegionId() {
  log("region", "running seed:region …")
  const r = runMedusa(["exec", "./src/scripts/seed-region.ts"])
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`
  const match = out.match(/MEDUSA_REGION_ID=(reg_[^\s]+)/)
  if (match?.[1]) {
    log("region", `OK — ${match[1]}`)
    return match[1]
  }
  if (r.status !== 0) {
    console.error(out)
    fail("region", "seed:region failed")
  }
  return null
}

function createAdminUser() {
  log("admin", `creating user ${ADMIN_EMAIL} …`)
  const r = runMedusa([
    "user",
    "-e",
    ADMIN_EMAIL,
    "-p",
    ADMIN_PASSWORD,
    "--admin",
  ])
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`
  if (r.status === 0) {
    log("admin", "created")
    return
  }
  if (/already exists|duplicate|unique/i.test(out)) {
    log("admin", "already exists — skip")
    return
  }
  if (r.status !== 0 && /created|success/i.test(out)) {
    log("admin", "created (non-zero exit ignored)")
    return
  }
  console.error(out)
  fail("admin", "user creation failed")
}

async function fetchOk(url, opts = {}) {
  const res = await fetch(url, opts)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { ok: res.ok, status: res.status, json, text }
}

async function waitForServer(maxMs = 60_000) {
  const killPort = () => {
    const r = spawnSync("lsof", ["-t", "-i", ":9000"], { encoding: "utf8" })
    for (const pid of (r.stdout ?? "").trim().split("\n").filter(Boolean)) {
      spawnSync("kill", [pid])
    }
  }

  const health = await fetchOk(`${BASE_URL}/health`)
  if (health.ok && process.env.SETUP_NO_RESTART === "1") {
    log("server", "already running on :9000 (SETUP_NO_RESTART=1)")
    return null
  }
  if (health.ok) {
    log("server", "restarting existing :9000 process to load latest code …")
    killPort()
    await new Promise((r) => setTimeout(r, 2000))
  }

  log("server", "starting npx medusa develop (background) …")
  const logFd = appendFileSync(logPath, `\n--- ${new Date().toISOString()} ---\n`)
  const child = spawn("node", [resolve(root, "scripts/with-env.mjs"), "develop"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    detached: false,
  })

  const writeLog = (chunk) => appendFileSync(logPath, chunk.toString())

  child.stdout?.on("data", writeLog)
  child.stderr?.on("data", writeLog)

  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const line = existsSync(logPath) ? readFileSync(logPath, "utf8") : ""
    if (/Server is ready on port:\s*9000/i.test(line)) {
      log("server", "ready on :9000")
      return child
    }
    const h = await fetchOk(`${BASE_URL}/health`)
    if (h.ok) {
      log("server", "health OK")
      return child
    }
    await new Promise((r) => setTimeout(r, 1000))
  }

  child.kill("SIGTERM")
  const tail = existsSync(logPath)
    ? readFileSync(logPath, "utf8").slice(-4000)
    : "(no log)"
  console.error(tail)
  fail("server", "timeout waiting for port 9000 — see .setup-auto.log")
}

async function adminLogin() {
  const res = await fetchOk(`${BASE_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  const token = res.json?.token
  if (!res.ok || !token) {
    console.error(res.text)
    fail("auth", `login failed (${res.status})`)
  }
  log("auth", "JWT obtained")
  return token
}

function readExistingPublishableKey() {
  if (!existsSync(envGeneratedPath)) return null
  const content = readFileSync(envGeneratedPath, "utf8")
  const m = content.match(/NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=(pk_[^\s]+)/)
  return m?.[1] ?? null
}

async function verifyPublishableKey(pk) {
  const res = await fetchOk(
    `${BASE_URL}/store/products?limit=1`,
    { headers: { "x-publishable-api-key": pk } }
  )
  return res.ok
}

async function getOrCreatePublishableKey(token) {
  const existing = readExistingPublishableKey()
  if (existing && (await verifyPublishableKey(existing))) {
    log("api-key", `reusing ${existing.slice(0, 12)}… from .env.generated`)
    return { id: null, token: existing }
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  const list = await fetchOk(`${BASE_URL}/admin/api-keys?type=publishable&title=${API_KEY_TITLE}`, {
    headers,
  })
  if (list.ok && list.json?.api_keys?.length) {
    const found = list.json.api_keys.find((k) => k.title === API_KEY_TITLE)
    if (found && existing && (await verifyPublishableKey(existing))) {
      return { id: found.id, token: existing }
    }
    log("api-key", "existing key found but token unknown — creating new key")
  }

  const create = await fetchOk(`${BASE_URL}/admin/api-keys`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: API_KEY_TITLE, type: "publishable" }),
  })
  const apiKey = create.json?.api_key
  const pk = apiKey?.token
  if (!create.ok || !pk?.startsWith("pk_")) {
    console.error(create.text)
    fail("api-key", "create publishable key failed")
  }
  log("api-key", `created ${pk.slice(0, 16)}…`)
  return { id: apiKey.id, token: pk }
}

async function linkSalesChannel(token, apiKeyId) {
  if (!apiKeyId) {
    log("sales-channel", "skip link (reused key)")
    return
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
  const sc = await fetchOk(`${BASE_URL}/admin/sales-channels`, { headers })
  const channelId = sc.json?.sales_channels?.[0]?.id
  if (!channelId) fail("sales-channel", "no default sales channel")
  log("sales-channel", `default channel ${channelId}`)

  const link = await fetchOk(`${BASE_URL}/admin/api-keys/${apiKeyId}/sales-channels`, {
    method: "POST",
    headers,
    body: JSON.stringify({ add: [channelId] }),
  })
  if (!link.ok) {
    console.error(link.text)
    fail("sales-channel", "link failed")
  }
  log("sales-channel", "linked to publishable key")
  return channelId
}

function garmentUrl() {
  const fromEnv =
    process.env.MEDUSA_TRYON_TEST_GARMENT_URL?.trim() ||
    process.env.TRYON_TEST_GARMENT_URL?.trim()
  if (fromEnv) {
    if (!fromEnv.includes("blob.vercel-storage.com") && !fromEnv.includes("cloudinary.com")) {
      log(
        "seed",
        "WARN: garment URL not on Vercel Blob/Cloudinary — validator may reject; using default"
      )
      return DEFAULT_GARMENT_URL
    }
    return fromEnv
  }
  return DEFAULT_GARMENT_URL
}

async function seedProduct(token, salesChannelId) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
  const url = garmentUrl()

  const existing = await fetchOk(
    `${BASE_URL}/admin/products?handle=${PRODUCT_HANDLE}&fields=id,handle`,
    { headers }
  )
  const found = existing.json?.products?.[0]
  if (found) {
    log("seed", `product ${PRODUCT_HANDLE} exists (${found.id}) — updating try-on`)
    const patch = await fetchOk(`${BASE_URL}/admin/products/${found.id}/try-on`, {
      method: "POST",
      headers,
      body: JSON.stringify({ try_on_enabled: true, tryon_garment_url: url }),
    })
    if (!patch.ok) {
      console.error(patch.text)
      fail("seed", "try-on patch failed")
    }
    return found.id
  }

  const body = {
    title: "Leggings Demo Try-On",
    handle: PRODUCT_HANDLE,
    status: "published",
    options: [{ title: "Size", values: ["One Size"] }],
    variants: [
      {
        title: "Default",
        options: { Size: "One Size" },
        prices: [{ amount: 4900, currency_code: "eur" }],
        manage_inventory: false,
      },
    ],
    additional_data: {
      try_on_enabled: true,
      tryon_garment_url: url,
    },
  }
  if (salesChannelId) {
    body.sales_channels = [{ id: salesChannelId }]
  }

  const create = await fetchOk(`${BASE_URL}/admin/products`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!create.ok) {
    console.error(create.text)
    fail("seed", "product create failed")
  }
  const productId = create.json?.product?.id
  log("seed", `created ${PRODUCT_HANDLE} (${productId}) try_on_enabled=true`)
  return productId
}

async function healthCheck(pk) {
  const res = await fetchOk(
    `${BASE_URL}/store/products?handle=${PRODUCT_HANDLE}&fields=try_on_enabled,tryon_garment_url`,
    { headers: { "x-publishable-api-key": pk } }
  )
  if (res.status !== 200) {
    console.error(res.text)
    fail("health", `store API returned ${res.status}`)
  }
  const product = res.json?.products?.[0]
  if (!product) fail("health", "product not found in store API")
  if (product.try_on_enabled !== true) {
    fail("health", `try_on_enabled=${product.try_on_enabled} (expected true)`)
  }
  log("health", `OK — ${PRODUCT_HANDLE} try_on_enabled=true`)
  return product
}

function writeEnvGenerated(pk, regionId) {
  const lines = [
    `# Auto-generated by scripts/setup-auto.mjs — ${new Date().toISOString()}`,
    `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${pk}`,
    `MEDUSA_BACKEND_URL=${BASE_URL}`,
    `MEDUSA_TRYON_TEST_HANDLE=${PRODUCT_HANDLE}`,
  ]
  if (regionId) lines.push(`MEDUSA_REGION_ID=${regionId}`)
  lines.push("")
  writeFileSync(envGeneratedPath, lines.join("\n"))
  log("output", `wrote ${envGeneratedPath}`)
}

function printSummary({ pk, product, serverChild, regionId }) {
  console.log("")
  console.log("══════════════════════════════════════════════════")
  console.log("  Medusa setup complete (zero-click)")
  console.log("══════════════════════════════════════════════════")
  console.log(`  Admin UI     ${BASE_URL}/app`)
  console.log(`  Admin login  ${ADMIN_EMAIL}`)
  console.log(`  Store API    ${BASE_URL}/store`)
  console.log(`  Publishable  ${pk}`)
  if (regionId) console.log(`  Region ID    ${regionId}`)
  console.log(`  Product      ${PRODUCT_HANDLE} (try_on_enabled: true)`)
  console.log(`  Garment URL  ${product?.tryon_garment_url ?? "—"}`)
  console.log(`  Env file     medusa-backend/.env.generated`)
  console.log("══════════════════════════════════════════════════")
  console.log("")
  console.log("Next.js — add to .env.local:")
  console.log(`  NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${pk}`)
  console.log(`  MEDUSA_BACKEND_URL=${BASE_URL}`)
  if (regionId) console.log(`  MEDUSA_REGION_ID=${regionId}`)
  console.log(`  MEDUSA_ADMIN_TOKEN=  # Medusa Admin → Settings → Secret API Keys`)
  console.log("")

  if (serverChild) {
    log("server", "Medusa develop running in background (PID " + serverChild.pid + ")")
  }
}

async function main() {
  console.log("[setup-auto] Affisell Medusa bootstrap\n")
  loadDotenv()
  validateEnv()
  const apiOnly = process.argv.includes("--api-only")
  if (!apiOnly) {
    ensureInstall()
    dbMigrate()
    await verifyProductTryOnTable()
    createAdminUser()
  }
  const regionId = seedRegionId()
  const serverChild = await waitForServer()
  const token = await adminLogin()
  const { id: apiKeyId, token: pk } = await getOrCreatePublishableKey(token)
  const salesChannelId = await linkSalesChannel(token, apiKeyId)
  await seedProduct(token, salesChannelId)
  const product = await healthCheck(pk)
  writeEnvGenerated(pk, regionId)
  printSummary({ pk, product, serverChild, regionId })
}

main().catch((err) => {
  console.error("[setup-auto] fatal:", err)
  process.exit(1)
})

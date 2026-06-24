#!/usr/bin/env node
/**
 * Link leggings-demo Prisma ↔ Medusa + validate try-on sync toggle OFF/ON.
 */
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"
import { config as loadEnv } from "dotenv"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = resolve(root, "..")
const medusaEnvPath = resolve(root, ".env")
const localEnvPath = resolve(repoRoot, ".env.local")
const MEDUSA = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"
const HANDLE = "leggings-demo"
const ADMIN_EMAIL = "admin@affisell.com"
const ADMIN_PASSWORD = "Affisell2026!"

function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return out
}

function log(step, msg) {
  console.log(`[validate-sync] ${step}: ${msg}`)
}

async function fetchJson(url, opts = {}) {
  try {
    const res = await fetch(url, opts)
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* ignore */
    }
    return { ok: res.ok, status: res.status, json, text }
  } catch (err) {
    return { ok: false, status: 0, json: null, text: String(err) }
  }
}

async function waitForMedusa(maxMs = 20_000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const h = await fetchJson(`${MEDUSA}/health`)
    if (h.ok) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

async function startMedusaBackground() {
  log("server", "starting medusa develop (background)…")
  const logPath = resolve(root, ".validate-sync.log")
  appendFileSync(logPath, `\n--- ${new Date().toISOString()} ---\n`)
  const child = spawn("node", [resolve(root, "scripts/with-env.mjs"), "develop"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  })
  child.stdout?.on("data", (c) => appendFileSync(logPath, c))
  child.stderr?.on("data", (c) => appendFileSync(logPath, c))
  const ok = await waitForMedusa(20_000)
  if (!ok) {
    console.error(readFileSync(logPath, "utf8").slice(-3000))
    throw new Error("Medusa failed to start within 20s")
  }
  log("server", "✅ ready on :9000")
  return child
}

async function main() {
  console.log("[validate-sync] leggings-demo Try-On sync validation\n")

  // ── 2. CHECK ENV ──
  const localEnv = parseEnvFile(localEnvPath)
  const localDb = localEnv.DATABASE_URL?.trim()
  let medusaEnvRaw = existsSync(medusaEnvPath) ? readFileSync(medusaEnvPath, "utf8") : ""
  const medusaParsed = parseEnvFile(medusaEnvPath)
  const prismaUrl = medusaParsed.DATABASE_URL_PRISMA?.trim()

  if (!localDb) {
    log("env", "❌ DATABASE_URL missing in ../.env.local")
    process.exit(1)
  }

  if (!prismaUrl) {
    log("env", "DATABASE_URL_PRISMA absent — adding from .env.local")
    const line = `DATABASE_URL_PRISMA="${localDb}"\n`
    if (medusaEnvRaw && !medusaEnvRaw.endsWith("\n")) medusaEnvRaw += "\n"
    writeFileSync(medusaEnvPath, medusaEnvRaw + line)
    loadEnv({ path: medusaEnvPath, override: true })
    log("env", "✅ DATABASE_URL_PRISMA added")
  } else if (prismaUrl === localDb) {
    log("env", "✅ DATABASE_URL_PRISMA matches affisell-market/.env.local")
  } else {
    log("env", "❌ DATABASE_URL_PRISMA differs from .env.local DATABASE_URL")
  }

  loadEnv({ path: medusaEnvPath, override: true })
  process.env.DATABASE_URL_PRISMA = process.env.DATABASE_URL_PRISMA || localDb

  // Use root @prisma/client (schema lives in ../prisma)
  const prismaClientPath = resolve(repoRoot, "node_modules/@prisma/client/index.js")
  const { PrismaClient } = await import(prismaClientPath)
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL_PRISMA } },
  })

  try {
    let linked = await prisma.product.updateMany({
      where: { medusaHandle: HANDLE },
      data: { medusaHandle: HANDLE },
    })

    if (linked.count === 0) {
      linked = await prisma.product.updateMany({
        where: {
          OR: [
            { name: { contains: "leggings", mode: "insensitive" } },
            { name: { contains: "Leggings Demo", mode: "insensitive" } },
          ],
        },
        data: { medusaHandle: HANDLE },
      })
    }

    log("link", `${linked.count} row(s) updated — medusaHandle='${HANDLE}'`)

    // ── 3. VERIFY MEDUSA ──
    let health = await fetchJson(`${MEDUSA}/health`)
    if (!health.ok) {
      await startMedusaBackground()
    } else {
      log("server", "✅ already running")
    }

    // ── 4. AUTH + GET PRODUCT ──
    const auth = await fetchJson(`${MEDUSA}/auth/user/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    })
    const token = auth.json?.token
    if (!token) {
      log("auth", `❌ login failed (${auth.status}): ${auth.text}`)
      process.exit(1)
    }
    log("auth", "✅ JWT obtained")

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }

    const list = await fetchJson(
      `${MEDUSA}/admin/products?handle=${HANDLE}&fields=id,handle,title`,
      { headers }
    )
    const productId = list.json?.products?.[0]?.id
    if (!productId) {
      log("medusa", `❌ product ${HANDLE} not found`)
      process.exit(1)
    }
    log("medusa", `product id=${productId}`)

    // ── 4. TOGGLE OFF via try-on route (reliable) ──
    const off = await fetchJson(`${MEDUSA}/admin/products/${productId}/try-on`, {
      method: "POST",
      headers,
      body: JSON.stringify({ try_on_enabled: false, tryon_garment_url: null }),
    })
    log("toggle-off", `status=${off.status} body=${JSON.stringify(off.json ?? off.text.slice(0, 200))}`)

    await new Promise((r) => setTimeout(r, 1500))

    // ── 5. VERIFY PRISMA OFF ──
    let p = await prisma.product.findFirst({ where: { medusaHandle: HANDLE } })
    let offOk = false
    if (p?.tryOnEnabled === false) {
      log("verify-off", "✅ Sync OK: tryOnEnabled = false")
      offOk = true
    } else {
      log("verify-off", `❌ expected false, got ${p?.tryOnEnabled}`)
    }

    // ── 6. TOGGLE ON ──
    const garmentUrl = "https://example.blob.vercel-storage.com/flatlay-test.png"
    const on = await fetchJson(`${MEDUSA}/admin/products/${productId}/try-on`, {
      method: "POST",
      headers,
      body: JSON.stringify({ try_on_enabled: true, tryon_garment_url: garmentUrl }),
    })
    log("toggle-on", `status=${on.status} body=${JSON.stringify(on.json ?? on.text.slice(0, 200))}`)

    await new Promise((r) => setTimeout(r, 1500))

    p = await prisma.product.findFirst({ where: { medusaHandle: HANDLE } })
    const onOk = p?.tryOnEnabled === true
    if (onOk) {
      log("verify-on", "✅ Sync OK: tryOnEnabled = true")
    } else {
      log("verify-on", `❌ expected true, got ${p?.tryOnEnabled}`)
    }

    // ── 7. OUTPUT ──
    console.log("\n══════════════════════════════════════════════════")
    console.log("  Try-On sync validation — leggings-demo")
    console.log("══════════════════════════════════════════════════")
    console.log(`  Prisma link     medusaHandle=${HANDLE} (${linked.count} row updated)`)
    console.log(`  Medusa product  ${productId}`)
    console.log(`  Toggle OFF      ${offOk ? "✅ tryOnEnabled=false" : "❌"}`)
    console.log(`  Toggle ON       ${onOk ? "✅ tryOnEnabled=true" : "❌"}`)
    console.log(`  Garment URL     ${p?.tryOnGarmentUrl ?? "—"}`)
    console.log("══════════════════════════════════════════════════\n")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error("[validate-sync] fatal:", err)
  process.exit(1)
})

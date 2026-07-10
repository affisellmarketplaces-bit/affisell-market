#!/usr/bin/env node
/**
 * Bulk import brands.csv → SupplierLead CRM (status CONTACTED, source linkedin).
 *
 * Usage:
 *   node scripts/import-leads-to-crm.mjs [brands.csv]
 *   node scripts/import-leads-to-crm.mjs --direct [brands.csv]   # Prisma direct (no HTTP)
 *
 * API mode (default): POST /api/admin/supplier-leads
 *   Auth: Authorization: Bearer ${CRON_SECRET}
 *   Base URL: APP_URL | VERCEL_APP_URL | NEXT_PUBLIC_APP_URL | devLocalhostOrigin()
 */
import fs from "node:fs"
import { resolve } from "node:path"
import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"
import { devLocalhostOrigin } from "./dev-localhost-url.mjs"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const args = process.argv.slice(2).filter((a) => a !== "--direct")
const direct = process.argv.includes("--direct")
const csvPath = resolve(process.cwd(), args[0] ?? "brands.csv")

const APP_URL = (
  process.env.APP_URL ||
  process.env.VERCEL_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  devLocalhostOrigin()
).replace(/\/$/, "")

const CRON_SECRET = process.env.CRON_SECRET?.trim()

function parseCsvLine(line) {
  const cells = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      cells.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []

  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]?.trim() ?? ""]))
  })
}

function toPayload(row) {
  const email = row.email?.trim()
  if (!email) return null

  return {
    brand: row.brand?.trim() || "Unknown",
    domain: row.domain?.trim() || email.split("@")[1] || "unknown",
    email,
    firstName: row.firstName?.trim() || null,
    linkedinUrl: row.linkedin?.trim() || null,
    source: "linkedin",
    status: "CONTACTED",
  }
}

async function postLeadApi(payload) {
  const headers = { "Content-Type": "application/json" }
  if (CRON_SECRET) {
    headers.Authorization = `Bearer ${CRON_SECRET}`
  }

  const res = await fetch(`${APP_URL}/api/admin/supplier-leads`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }

  return { created: Boolean(data.created), lead: data.lead }
}

async function postLeadDirect(prisma, payload) {
  const email = payload.email.trim().toLowerCase()
  const existing = await prisma.supplierLead.findUnique({ where: { email } })
  if (existing) {
    return { created: false, lead: existing }
  }

  const lead = await prisma.supplierLead.create({
    data: {
      email,
      domain: payload.domain,
      brand: payload.brand,
      firstName: payload.firstName,
      linkedinUrl: payload.linkedinUrl,
      source: payload.source,
      status: "CONTACTED",
    },
  })

  return { created: true, lead }
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    console.error(`[import-leads-to-crm] missing file: ${csvPath}`)
    process.exit(1)
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"))
  const payloads = rows.map(toPayload).filter(Boolean)

  if (payloads.length === 0) {
    console.error("[import-leads-to-crm] no valid rows in CSV")
    process.exit(1)
  }

  console.error(
    `[import-leads-to-crm] mode=${direct ? "direct" : "api"} rows=${payloads.length} target=${direct ? "database" : APP_URL}`
  )

  const prisma = direct ? new PrismaClient() : null
  let created = 0
  let skipped = 0
  let failed = 0

  try {
    for (const payload of payloads) {
      try {
        const result = direct
          ? await postLeadDirect(prisma, payload)
          : await postLeadApi(payload)

        if (result.created) {
          created++
          console.error(`[import-leads-to-crm] + ${payload.email} (${payload.brand})`)
        } else {
          skipped++
          console.error(`[import-leads-to-crm] skip ${payload.email} (exists)`)
        }
      } catch (err) {
        failed++
        console.error(`[import-leads-to-crm] FAIL ${payload.email}:`, err instanceof Error ? err.message : err)
      }
    }
  } finally {
    if (prisma) await prisma.$disconnect()
  }

  console.error(
    `[import-leads-to-crm] done created=${created} skipped=${skipped} failed=${failed} total=${payloads.length}`
  )

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error("[import-leads-to-crm]", err)
  process.exit(1)
})

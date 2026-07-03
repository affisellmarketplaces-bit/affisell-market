#!/usr/bin/env node
/**
 * Preflight Notion CRM for /enterprise + /crm.
 * Loads .env.local then .env (same order as Next.js).
 */
import { config } from "dotenv"
import { resolve } from "node:path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const NOTION_VERSION = "2022-06-28"

function normalizeId(raw) {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toLowerCase()
  }
  const compact = trimmed.replace(/-/g, "")
  if (/^[0-9a-f]{32}$/i.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`.toLowerCase()
  }
  return trimmed
}

function detectSchema(properties) {
  const byName = new Map(Object.entries(properties).map(([n, p]) => [n, p.type]))
  if (byName.get("Nom") === "title" && byName.get("E-mail") === "email") return "crm_affisell"
  if (byName.get("Name") === "title") return "supplier_pipeline"
  return "crm_affisell"
}

async function main() {
  const token = process.env.NOTION_API_KEY?.trim()
  const databaseId = normalizeId(process.env.NOTION_CRM_DATABASE_ID)
  if (!token || !databaseId) {
    console.error("[verify:notion-crm] missing NOTION_API_KEY or NOTION_CRM_DATABASE_ID")
    process.exit(1)
  }

  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error("[verify:notion-crm] notion_http", res.status, body.slice(0, 300))
    process.exit(1)
  }

  const data = await res.json()
  const schema = detectSchema(data.properties ?? {})
  const title = data.title?.map((t) => t.plain_text).join("") ?? "(untitled)"
  const columns = Object.entries(data.properties ?? {}).map(([n, p]) => `${n}:${p.type}`)

  console.log("[verify:notion-crm] ok", { database: title, schema, columns: columns.join(", ") })
}

main().catch((e) => {
  console.error("[verify:notion-crm]", e instanceof Error ? e.message : String(e))
  process.exit(1)
})

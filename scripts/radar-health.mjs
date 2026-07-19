#!/usr/bin/env node
/**
 * Radar health check — never dumps secrets.
 * Usage: npm run radar:health
 * Env: NEXT_PUBLIC_APP_URL or RADAR_HEALTH_URL (default http://127.0.0.1:3001)
 */
import nextEnv from "@next/env"

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const base =
  process.env.RADAR_HEALTH_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://127.0.0.1:3001"

const url = `${base.replace(/\/$/, "")}/api/radar/health`

const res = await fetch(url, { method: "GET" })
const text = await res.text()
let json
try {
  json = JSON.parse(text)
} catch {
  json = { raw: text.slice(0, 200) }
}

console.log("[radar:health]", {
  url,
  status: res.status,
  ok: res.ok,
  radarEnabled: json?.radarEnabled ?? null,
  redis: json?.redis ?? null,
  db: json?.db ?? null,
  serper: json?.serper ?? null,
  tiktokCrawler: json?.tiktokCrawler ?? null,
  degradedCrawler: json?.degradedCrawler ?? null,
})

if (!res.ok) {
  console.error("[radar:health] FAILED — expected 200 when RADAR_ENABLED=true")
  process.exit(1)
}

process.exit(0)

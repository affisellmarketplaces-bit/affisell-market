#!/usr/bin/env node
/**
 * Radar Prisma CLI — Neon-first (no Docker required).
 * Usage: node scripts/radar-db.mjs push | studio | generate
 *
 * URL resolution:
 *   RADAR_DATABASE_URL (if set and not localhost:5434)
 *   → MARKET_INTELLI_DATABASE_URL (same, skip docker local)
 *   → DATABASE_URL_UNPOOLED / DATABASE_URL (Affisell Neon, schema market_intelli)
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { config as loadEnv } from "dotenv"
import { ensureDirectUrl } from "./ensure-direct-url.mjs"

const root = resolve(import.meta.dirname, "..")

for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) loadEnv({ path, override: true })
}

/** Local docker-compose marketintelli_db — skip when Neon DATABASE_URL is available. */
function isDockerLocalRadarUrl(url) {
  try {
    const u = new URL(url)
    const host = u.hostname === "localhost" || u.hostname === "127.0.0.1"
    return host && (u.port === "5434" || u.port === "")
  } catch {
    return /localhost:5434|127\.0\.0\.1:5434/.test(url)
  }
}

function maskDbUrl(url) {
  return url.replace(/:\/\/([^:/@]+):([^@]+)@/, "://$1:***@")
}

function normalizeRadarDirectUrl(rawUrl) {
  if (!rawUrl?.trim()) return undefined
  let direct = rawUrl.trim()
  try {
    const parsed = new URL(direct)
    if (parsed.hostname.includes("-pooler")) {
      parsed.hostname = parsed.hostname.replace(/-pooler/g, "")
    }
    parsed.searchParams.delete("pgbouncer")
    parsed.searchParams.delete("connection_limit")
    if (!parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require")
    }
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "60")
    }
    const query = parsed.searchParams.toString()
    parsed.search = query ? `?${query}` : ""
    direct = parsed.toString()
  } catch {
    direct = direct
      .replace(/-pooler/g, "")
      .replace(/([?&])pgbouncer=true&?/gi, "$1")
      .replace(/[?&]$/, "")
  }
  return direct
}

function resolveRadarUrl() {
  const candidates = [
    { source: "RADAR_DATABASE_URL", url: process.env.RADAR_DATABASE_URL?.trim() },
    { source: "MARKET_INTELLI_DATABASE_URL", url: process.env.MARKET_INTELLI_DATABASE_URL?.trim() },
  ]

  for (const c of candidates) {
    if (!c.url) continue
    if (isDockerLocalRadarUrl(c.url)) {
      console.log(
        `[radar-db] Skipping ${c.source} (docker localhost:5434) — using Affisell DATABASE_URL / Neon`
      )
      continue
    }
    return { source: c.source, url: normalizeRadarDirectUrl(c.url) }
  }

  // Derive Neon direct URL (pooler → direct) without forcing localhost.
  ensureDirectUrl()
  const neon =
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    undefined
  if (neon) {
    return {
      source: process.env.DATABASE_URL_UNPOOLED?.trim()
        ? "DATABASE_URL_UNPOOLED"
        : "DATABASE_URL",
      url: normalizeRadarDirectUrl(neon),
    }
  }

  return null
}

const resolved = resolveRadarUrl()
if (!resolved?.url) {
  console.error(
    "[radar-db] No database URL found. Set DATABASE_URL (Neon) or RADAR_DATABASE_URL in .env.local"
  )
  process.exit(1)
}

process.env.RADAR_DATABASE_URL = resolved.url
console.log(`[radar-db] Using ${resolved.source}:`, maskDbUrl(resolved.url))

const cmd = process.argv[2] ?? "push"
const schema = "prisma/radar.schema.prisma"

const prismaArgs =
  cmd === "studio"
    ? ["studio", `--schema=${schema}`]
    : cmd === "generate"
      ? ["generate", `--schema=${schema}`]
      : ["db", "push", `--schema=${schema}`, "--skip-generate"]

const result = spawnSync("npx", ["prisma", ...prismaArgs], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
})

process.exit(result.status ?? 1)

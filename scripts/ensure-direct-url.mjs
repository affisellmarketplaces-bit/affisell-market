#!/usr/bin/env node
/**
 * Neon: runtime may use pooled DATABASE_URL; migrations need a direct connection.
 * If DIRECT_URL is unset, derive it from DATABASE_URL (strip -pooler host + pgbouncer params).
 */
export function ensureDirectUrl() {
  if (process.env.DIRECT_URL?.trim()) {
    return process.env.DIRECT_URL.trim()
  }

  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    return undefined
  }

  let direct = databaseUrl

  try {
    const parsed = new URL(databaseUrl)
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
    direct = databaseUrl
      .replace(/-pooler/g, "")
      .replace(/([?&])pgbouncer=true&?/gi, "$1")
      .replace(/[?&]$/, "")
  }

  process.env.DIRECT_URL = direct

  if (direct !== databaseUrl) {
    console.log(
      "[ensure-direct-url] DIRECT_URL derived from DATABASE_URL (pooler → direct for migrate)"
    )
  }

  return direct
}

ensureDirectUrl()

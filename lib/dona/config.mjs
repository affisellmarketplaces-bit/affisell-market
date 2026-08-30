/**
 * ESM mirror of lib/dona/config.ts — for Node scripts (no TS compile step).
 */

import { loadEnv, resolveDatabaseUrlOptional } from "../env.mjs"

const PROD_MARKER = "misty-sea"
const STAGING_MARKER = "shy-wind"
const LOCAL_DB_RE = /^(localhost|127\.0\.0\.1)$/i

function extractHostFromDatabaseUrl(rawUrl) {
  const trimmed = rawUrl?.trim()
  if (!trimmed) return ""

  const match = trimmed.match(/@([^/?#]+)/)
  if (match?.[1]) return match[1]

  try {
    return new URL(trimmed).hostname
  } catch {
    return ""
  }
}

function neonEndpointSlug(host) {
  const match = host.match(/^(ep-[a-z0-9-]+)/i)
  return match?.[1] ?? host
}

function resolveNeonBranchFromHost(host) {
  const h = host.toLowerCase()
  if (!h) return "unknown"
  if (LOCAL_DB_RE.test(h)) return "local"
  if (h.includes(STAGING_MARKER)) return "staging"
  if (h.includes(PROD_MARKER)) return "production"
  return "unknown"
}

function resolveDonaEnv(databaseUrl, stagingUrl, host) {
  const urlLower = databaseUrl.toLowerCase()
  const hostLower = host.toLowerCase()

  if (urlLower.includes(PROD_MARKER) || hostLower.includes(PROD_MARKER)) {
    return "prod"
  }
  if (
    urlLower.includes(STAGING_MARKER) ||
    hostLower.includes(STAGING_MARKER) ||
    (!databaseUrl && stagingUrl)
  ) {
    return "staging"
  }

  const branch = resolveNeonBranchFromHost(host)
  if (branch === "production") return "prod"
  return "staging"
}

/** @returns {{ env: 'prod'|'staging', branch: string, dbHost: string, isProd: boolean }} */
export function getEnvInfo() {
  loadEnv()
  const databaseUrl = process.env.DATABASE_URL?.trim() || ""
  const stagingUrl = process.env.DATABASE_URL_STAGING?.trim() || ""
  const resolvedUrl = databaseUrl || stagingUrl || resolveDatabaseUrlOptional() || ""
  const host = extractHostFromDatabaseUrl(resolvedUrl)
  const env = resolveDonaEnv(databaseUrl, stagingUrl || resolvedUrl, host)
  const branch = env === "prod" ? "production" : "staging"

  return {
    env,
    branch,
    dbHost: host ? neonEndpointSlug(host) : "(unset)",
    isProd: env === "prod",
  }
}

/**
 * Affisell environment helpers — Node scripts (dev preflight, env:check).
 * TypeScript mirror: @/lib/db-env
 */

const NEON_HOST_RE = /\.(?:aws\.)?neon\.tech$/i
const LOCAL_DB_RE = /^(localhost|127\.0\.0\.1)$/i
const PROD_NEON_MARKER = "misty-sea"
const STAGING_NEON_MARKER = "shy-wind"

/** @typedef {'LOCAL' | 'PREVIEW' | 'PRODUCTION'} AffisellEnvLabel */
/** @typedef {'staging' | 'production' | 'local' | 'unknown'} NeonBranchLabel */

/**
 * @returns {AffisellEnvLabel}
 */
export function resolveAffisellEnv() {
  const vercel = process.env.VERCEL_ENV?.trim().toLowerCase()
  if (vercel === "production") return "PRODUCTION"
  if (vercel === "preview") return "PREVIEW"
  if (process.env.NODE_ENV === "production" && !vercel) return "PRODUCTION"
  return "LOCAL"
}

/**
 * @returns {string}
 */
export function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.DATABASE_URL_STAGING?.trim() ||
    ""
  )
}

/**
 * @param {string | undefined | null} rawUrl
 */
export function extractHostFromDatabaseUrl(rawUrl) {
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

/**
 * @param {string} host
 * @returns {NeonBranchLabel}
 */
export function resolveNeonBranchFromHost(host) {
  const h = host.toLowerCase()
  if (!h) return "unknown"
  if (LOCAL_DB_RE.test(h)) return "local"
  if (h.includes(STAGING_NEON_MARKER)) return "staging"
  if (h.includes(PROD_NEON_MARKER)) return "production"
  if (NEON_HOST_RE.test(h)) return "unknown"
  return "local"
}

/**
 * @param {string} host
 */
export function isPoolerHost(host) {
  return /-pooler\./i.test(host)
}

/**
 * @param {string | undefined | null} rawUrl
 */
export function parseDatabaseUrl(rawUrl) {
  const empty = {
    host: "",
    maskedHost: "(unset)",
    branch: "unknown",
    endpointId: "",
    isLocalhost: false,
    isNeon: false,
    pooling: false,
  }
  const trimmed = rawUrl?.trim()
  if (!trimmed) return empty

  const host = extractHostFromDatabaseUrl(trimmed)
  if (!host) return { ...empty, maskedHost: "(invalid url)" }

  const endpointMatch = host.match(/^(ep-[a-z0-9-]+)/i)
  const endpointId = endpointMatch?.[1] ?? ""
  const branch = resolveNeonBranchFromHost(host)
  let pooling = isPoolerHost(host)
  if (!pooling) {
    try {
      pooling = new URL(trimmed).searchParams.get("pgbouncer") === "true"
    } catch {
      /* ignore */
    }
  }

  return {
    host,
    maskedHost: maskDbHost(host),
    branch,
    endpointId,
    isLocalhost: LOCAL_DB_RE.test(host),
    isNeon: NEON_HOST_RE.test(host),
    pooling,
  }
}

/**
 * @param {string} host
 */
export function maskDbHost(host) {
  if (!host) return "(unset)"
  if (LOCAL_DB_RE.test(host)) return "localhost:***"

  const neon = host.match(/^(ep-[a-z0-9]+(?:-[a-z0-9]+)*)(.*)$/i)
  if (neon?.[1]) {
    const prefix = neon[1]
    const suffix = neon[2] ?? ""
    const parts = prefix.split("-")
    if (parts.length >= 3) {
      parts[parts.length - 1] = "****"
      return `${parts.join("-")}${suffix}`
    }
    return `${prefix.slice(0, Math.min(12, prefix.length))}****${suffix}`
  }

  const segments = host.split(".")
  if (segments.length >= 2) {
    segments[0] = `${segments[0].slice(0, 4)}****`
    return segments.join(".")
  }
  return `${host.slice(0, 4)}****`
}

/**
 * @returns {boolean}
 */
export function previewPointsAtProdDb(databaseUrl) {
  if (process.env.VERCEL_ENV?.trim().toLowerCase() !== "preview") return false
  const url = databaseUrl?.trim() || resolveDatabaseUrl()
  if (!url) return false
  const host = extractHostFromDatabaseUrl(url).toLowerCase()
  return host.includes(PROD_NEON_MARKER)
}

/**
 * @returns {string[]}
 */
export function getActiveFeatureFlags() {
  const active = []
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("NEXT_PUBLIC_FF_")) continue
    if (value === "1" || value === "true") {
      active.push(key.replace(/^NEXT_PUBLIC_FF_/, "").toLowerCase())
    }
  }
  return active.sort()
}

/**
 * @param {string | undefined | null} databaseUrl
 */
export function getDbEnvSnapshot(databaseUrl) {
  const env = resolveAffisellEnv()
  const url = databaseUrl?.trim() || resolveDatabaseUrl()
  const parsed = parseDatabaseUrl(url)

  return {
    env,
    isProd: parsed.branch === "production",
    isStaging: parsed.branch === "staging",
    isLocal: env === "LOCAL" || parsed.branch === "local",
    dbHost: parsed.maskedHost,
    dbBranch: parsed.branch,
    endpointId: parsed.endpointId,
    pooling: parsed.pooling,
    featureFlags: getActiveFeatureFlags(),
  }
}

/**
 * @param {{ exitOnFail?: boolean }} [options]
 */
export function runEnvSecurityChecks(options = {}) {
  const { exitOnFail = false } = options
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? ""
  const snapshot = getDbEnvSnapshot(databaseUrl || resolveDatabaseUrl())
  const parsed = parseDatabaseUrl(databaseUrl)
  let ok = true

  if (process.env.NODE_ENV === "production" && parsed.isLocalhost && databaseUrl) {
    console.error(
      "\n[affisell env] FATAL: NODE_ENV=production but DATABASE_URL points to localhost.\n" +
        "Use Neon production URL on Vercel Production — never localhost.\n"
    )
    ok = false
    if (exitOnFail) process.exit(1)
  }

  if (previewPointsAtProdDb(databaseUrl)) {
    console.error(
      "\n\x1b[31m⚠️  PREVIEW POINTE SUR PROD DB! Utilise DATABASE_URL_STAGING\x1b[0m\n" +
        "   Fix: Vercel Preview → DATABASE_URL = ep-shy-wind-… (Neon staging branch).\n" +
        `   Current: ${parsed.maskedHost} (branch=production)\n`
    )
    ok = false
  }

  return { ok, snapshot }
}

/**
 * @param {ReturnType<typeof getDbEnvSnapshot>} snapshot
 */
export function formatEnvCheckLine(snapshot) {
  const pooling = snapshot.pooling ? "yes" : "no"
  return `[affisell env] ${snapshot.env} | DB: ${snapshot.dbHost} | Branch: ${snapshot.dbBranch} | Pooling: ${pooling}`
}

/**
 * @param {ReturnType<typeof getDbEnvSnapshot>} snapshot
 */
export function formatFeatureFlagsLine(snapshot) {
  if (snapshot.featureFlags.length === 0) {
    return "[affisell env] Feature flags: (none active)"
  }
  return `[affisell env] Feature flags: ${snapshot.featureFlags.join(", ")}`
}

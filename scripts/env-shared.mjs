/**
 * Affisell environment helpers — Node scripts (dev preflight, env:check).
 * TypeScript mirror: @/lib/db-env
 */

const NEON_HOST_RE = /\.(?:aws\.)?neon\.tech$/i
const LOCAL_DB_RE = /^(localhost|127\.0\.0\.1)$/i

/** @typedef {'LOCAL' | 'PREVIEW' | 'PRODUCTION'} AffisellEnvLabel */

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
  }
  const trimmed = rawUrl?.trim()
  if (!trimmed) return empty

  try {
    const url = new URL(trimmed)
    const host = url.hostname
    const endpointMatch = host.match(/^(ep-[a-z0-9-]+)/i)
    const endpointId = endpointMatch?.[1] ?? ""
    const branch =
      url.searchParams.get("branch")?.trim() ||
      url.searchParams.get("options")?.match(/branch=([^&]+)/i)?.[1]?.trim() ||
      url.pathname.replace(/^\//, "").split("/")[0] ||
      "main"

    return {
      host,
      maskedHost: maskDbHost(host),
      branch,
      endpointId,
      isLocalhost: LOCAL_DB_RE.test(host),
      isNeon: NEON_HOST_RE.test(host),
    }
  } catch {
    return { ...empty, maskedHost: "(invalid url)" }
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
 * @param {string | undefined | null} endpointId
 */
export function getProdDbEndpointId(endpointId) {
  const fromEnv =
    process.env.AFFISELL_PROD_DB_ENDPOINT?.trim() ||
    process.env.DATABASE_URL_PRODUCTION_ENDPOINT?.trim()
  if (fromEnv) return fromEnv.replace(/^ep-/i, "ep-")

  const prodUrl = process.env.DATABASE_URL_PRODUCTION?.trim()
  if (prodUrl) {
    return parseDatabaseUrl(prodUrl).endpointId
  }

  return endpointId?.trim() ?? ""
}

/**
 * @returns {boolean}
 */
export function previewPointsAtProdDb(databaseUrl) {
  if (resolveAffisellEnv() !== "PREVIEW") return false

  const current = parseDatabaseUrl(databaseUrl)
  if (current.isLocalhost || !current.isNeon) return false

  const stagingUrl = process.env.DATABASE_URL_STAGING?.trim()
  if (stagingUrl) {
    const staging = parseDatabaseUrl(stagingUrl)
    if (
      staging.endpointId &&
      current.endpointId &&
      staging.endpointId === current.endpointId
    ) {
      return false
    }
  }

  const prodEndpoint = getProdDbEndpointId(current.endpointId)
  if (!prodEndpoint || !current.endpointId) return false

  return current.endpointId.toLowerCase() === prodEndpoint.toLowerCase()
}

/**
 * @returns {{ env: AffisellEnvLabel, isProd: boolean, isStaging: boolean, isLocal: boolean, dbHost: string, dbBranch: string, endpointId: string }}
 */
export function getDbEnvSnapshot(databaseUrl = process.env.DATABASE_URL) {
  const env = resolveAffisellEnv()
  const parsed = parseDatabaseUrl(databaseUrl)

  return {
    env,
    isProd: env === "PRODUCTION",
    isStaging: env === "PREVIEW",
    isLocal: env === "LOCAL",
    dbHost: parsed.maskedHost,
    dbBranch: parsed.branch,
    endpointId: parsed.endpointId,
  }
}

/**
 * @param {{ exitOnFail?: boolean }} [options]
 * @returns {{ ok: boolean, snapshot: ReturnType<typeof getDbEnvSnapshot> }}
 */
export function runEnvSecurityChecks(options = {}) {
  const { exitOnFail = false } = options
  const snapshot = getDbEnvSnapshot()
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? ""
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
      "\n\x1b[31m⚠️  PREVIEW pointe sur PROD DB — utilise branch!\x1b[0m\n" +
        "   Fix: Vercel Preview → DATABASE_URL = Neon branch (DATABASE_URL_STAGING).\n" +
        "   Neon Dashboard → Branches → Create from main → copy branch connection string.\n" +
        `   Current: ${parsed.maskedHost} (endpoint ${parsed.endpointId || "?"})\n`
    )
    ok = false
  }

  return { ok, snapshot }
}

/**
 * @param {ReturnType<typeof getDbEnvSnapshot>} snapshot
 */
export function formatEnvCheckLine(snapshot) {
  return `[affisell env] ${snapshot.env} DB=${snapshot.dbHost} branch=${snapshot.dbBranch}`
}

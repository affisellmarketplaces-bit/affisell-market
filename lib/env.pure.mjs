/** Pure env helpers — Node scripts mirror (no fs / dotenv / import.meta). */

export const PROD_NEON_MARKER = "misty-sea"
export const STAGING_NEON_MARKER = "shy-wind"

function looksLikePostgresUrl(value) {
  const lower = value.toLowerCase()
  return (
    lower.includes("postgres") ||
    lower.includes("neon") ||
    value.includes(STAGING_NEON_MARKER)
  )
}

/** @param {string} raw */
export function normalizePostgresDatabaseUrl(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (/^postgres(?:ql)?:postgres(?:ql)?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^postgres(?:ql)?:/i, "")
  }
  return trimmed
}

/** @returns {string | null} */
export function findStagingDatabaseUrlFromEnv() {
  const explicit = process.env.DATABASE_URL_STAGING?.trim()
  if (explicit) return normalizePostgresDatabaseUrl(explicit)

  for (const [key, value] of Object.entries(process.env)) {
    if (!value?.trim()) continue
    if (!key.toUpperCase().includes("STAGING")) continue
    const trimmed = value.trim()
    if (looksLikePostgresUrl(trimmed)) {
      return normalizePostgresDatabaseUrl(trimmed)
    }
  }

  return null
}

/** @returns {string | null} */
export function resolveDatabaseUrlOptional() {
  return process.env.DATABASE_URL?.trim() || findStagingDatabaseUrlFromEnv()
}

/** @returns {string} */
export function getDatabaseUrl() {
  const primary = process.env.DATABASE_URL?.trim()
  if (primary) return normalizePostgresDatabaseUrl(primary)

  const staging = findStagingDatabaseUrlFromEnv()
  if (staging) return staging

  throw new Error("Dona: DATABASE_URL et STAGING manquants, vérifie .env.local")
}

/** @returns {string | null} */
export function resolveStagingDatabaseUrl() {
  const fromStagingKey = findStagingDatabaseUrlFromEnv()
  if (fromStagingKey) return fromStagingKey

  const primary = process.env.DATABASE_URL?.trim()
  if (primary?.includes(STAGING_NEON_MARKER)) {
    return primary
  }

  return null
}

/** @param {string} stagingUrl */
export function applyStagingDevEnv(stagingUrl) {
  process.env.DATABASE_URL = normalizePostgresDatabaseUrl(stagingUrl)
  process.env.AFFISELL_DEV_STAGING = "1"
}

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
  if (h.includes(STAGING_NEON_MARKER)) return "staging"
  if (h.includes(PROD_NEON_MARKER)) return "production"
  return "unknown"
}

function resolveDonaEnv(databaseUrl, stagingUrl, host) {
  const urlLower = databaseUrl.toLowerCase()
  const hostLower = host.toLowerCase()

  if (urlLower.includes(PROD_NEON_MARKER) || hostLower.includes(PROD_NEON_MARKER)) {
    return "prod"
  }
  if (
    urlLower.includes(STAGING_NEON_MARKER) ||
    hostLower.includes(STAGING_NEON_MARKER) ||
    (!databaseUrl && stagingUrl)
  ) {
    return "staging"
  }

  if (resolveNeonBranchFromHost(host) === "production") return "prod"
  return "staging"
}

/** @returns {{ env: 'prod'|'staging', branch: string, dbHost: string, isProd: boolean }} */
export function getEnvInfo() {
  const databaseUrl = process.env.DATABASE_URL?.trim() || ""
  const stagingUrl = process.env.DATABASE_URL_STAGING?.trim() || ""
  const resolvedUrl = databaseUrl || stagingUrl || resolveDatabaseUrlOptional() || ""
  const host = extractHostFromDatabaseUrl(resolvedUrl)
  const env = resolveDonaEnv(databaseUrl || resolvedUrl, stagingUrl || resolvedUrl, host)

  return {
    env,
    branch: env === "prod" ? "production" : "staging",
    dbHost: host ? neonEndpointSlug(host) : "(unset)",
    isProd: env === "prod",
  }
}

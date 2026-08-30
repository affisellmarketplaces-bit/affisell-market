import {
  extractHostFromDatabaseUrl,
  maskDbHost,
  resolveNeonBranchFromHost,
} from "@/lib/db-env"

export const PROD_NEON_MARKER = "misty-sea"
export const STAGING_NEON_MARKER = "shy-wind"

export type DonaRuntimeEnv = "prod" | "staging"

export type DonaEnvInfo = {
  env: DonaRuntimeEnv
  branch: string
  dbHost: string
  isProd: boolean
}

function neonEndpointSlug(host: string): string {
  const match = host.match(/^(ep-[a-z0-9-]+)/i)
  return match?.[1] ?? host
}

function resolveDonaEnv(databaseUrl: string, stagingUrl: string, host: string): DonaRuntimeEnv {
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

  const branch = resolveNeonBranchFromHost(host)
  if (branch === "production") return "prod"
  return "staging"
}

function looksLikePostgresUrl(value: string): boolean {
  const lower = value.toLowerCase()
  return (
    lower.includes("postgres") ||
    lower.includes("neon") ||
    value.includes(STAGING_NEON_MARKER)
  )
}

/** Fix copy-paste / dotenv double-scheme: `postgresql:postgresql://…` → `postgresql://…`. */
export function normalizePostgresDatabaseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (/^postgres(?:ql)?:postgres(?:ql)?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^postgres(?:ql)?:/i, "")
  }
  return trimmed
}

/** Scan process.env for *STAGING* keys with a postgres/neon URL. */
export function findStagingDatabaseUrlFromEnv(): string | null {
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

/** Resolved DB URL without throwing — diagnostics only (reads process.env as-is). */
export function resolveDatabaseUrlOptional(): string | null {
  return process.env.DATABASE_URL?.trim() || findStagingDatabaseUrlFromEnv()
}

/** Primary DATABASE_URL with staging fallbacks (Next-safe — no fs/dotenv). */
export function getDatabaseUrl(): string {
  const primary = process.env.DATABASE_URL?.trim()
  if (primary) return normalizePostgresDatabaseUrl(primary)

  const staging = findStagingDatabaseUrlFromEnv()
  if (staging) return staging

  throw new Error("Dona: DATABASE_URL et STAGING manquants, vérifie .env.local")
}

/** Staging branch URL for `npm run dev:staging` (after loader injected process.env). */
export function resolveStagingDatabaseUrl(): string | null {
  const fromStagingKey = findStagingDatabaseUrlFromEnv()
  if (fromStagingKey) return fromStagingKey

  const primary = process.env.DATABASE_URL?.trim()
  if (primary?.includes(STAGING_NEON_MARKER)) {
    return primary
  }

  return null
}

export function applyStagingDevEnv(stagingUrl: string): void {
  process.env.DATABASE_URL = normalizePostgresDatabaseUrl(stagingUrl)
  process.env.AFFISELL_DEV_STAGING = "1"
}

/** Dona terminal — env detection from process.env only (Node scripts: call loadEnv first). */
export function getEnvInfo(): DonaEnvInfo {
  const databaseUrl = process.env.DATABASE_URL?.trim() || ""
  const stagingUrl = process.env.DATABASE_URL_STAGING?.trim() || ""
  const resolvedUrl = databaseUrl || stagingUrl || resolveDatabaseUrlOptional() || ""
  const host = extractHostFromDatabaseUrl(resolvedUrl)
  const env = resolveDonaEnv(databaseUrl || resolvedUrl, stagingUrl || resolvedUrl, host)
  const branch = env === "prod" ? "production" : "staging"

  return {
    env,
    branch,
    dbHost: host ? neonEndpointSlug(host) : maskDbHost(host),
    isProd: env === "prod",
  }
}

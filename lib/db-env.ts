/**
 * Affisell runtime environment — DB host, branch, LOCAL / PREVIEW / PRODUCTION.
 * Mirror of scripts/env-shared.mjs for TypeScript imports.
 */

export type AffisellEnvLabel = "LOCAL" | "PREVIEW" | "PRODUCTION"

export type DbEnvInfo = {
  env: AffisellEnvLabel
  isProd: boolean
  isStaging: boolean
  isLocal: boolean
  dbHost: string
  dbBranch: string
  endpointId: string
}

const NEON_HOST_RE = /\.(?:aws\.)?neon\.tech$/i
const LOCAL_DB_RE = /^(localhost|127\.0\.0\.1)$/i

type ParsedDbUrl = {
  host: string
  maskedHost: string
  branch: string
  endpointId: string
  isLocalhost: boolean
  isNeon: boolean
}

export function resolveAffisellEnv(): AffisellEnvLabel {
  const vercel = process.env.VERCEL_ENV?.trim().toLowerCase()
  if (vercel === "production") return "PRODUCTION"
  if (vercel === "preview") return "PREVIEW"
  if (process.env.NODE_ENV === "production" && !vercel) return "PRODUCTION"
  return "LOCAL"
}

export function maskDbHost(host: string): string {
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

function parseDatabaseUrl(rawUrl: string | undefined | null): ParsedDbUrl {
  const empty: ParsedDbUrl = {
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

function getProdDbEndpointId(fallbackEndpointId?: string): string {
  const fromEnv =
    process.env.AFFISELL_PROD_DB_ENDPOINT?.trim() ||
    process.env.DATABASE_URL_PRODUCTION_ENDPOINT?.trim()
  if (fromEnv) return fromEnv.replace(/^ep-/i, "ep-")

  const prodUrl = process.env.DATABASE_URL_PRODUCTION?.trim()
  if (prodUrl) {
    return parseDatabaseUrl(prodUrl).endpointId
  }

  return fallbackEndpointId?.trim() ?? ""
}

export function previewPointsAtProdDb(databaseUrl?: string): boolean {
  if (resolveAffisellEnv() !== "PREVIEW") return false

  const current = parseDatabaseUrl(databaseUrl ?? process.env.DATABASE_URL)
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

/** Current Affisell environment + masked DB metadata (safe to log). */
export function getDbEnv(databaseUrl?: string): DbEnvInfo {
  const env = resolveAffisellEnv()
  const parsed = parseDatabaseUrl(databaseUrl ?? process.env.DATABASE_URL)

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

/** Log once at Prisma client boot — no query interception. */
export function logDbEnvBoot(databaseUrl?: string): void {
  const info = getDbEnv(databaseUrl)
  console.log("[db]", {
    env: info.env,
    host: info.dbHost,
    branch: info.dbBranch,
    isProd: info.isProd,
    isStaging: info.isStaging,
    isLocal: info.isLocal,
  })
}

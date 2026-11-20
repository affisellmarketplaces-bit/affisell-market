/**
 * Affisell runtime environment — DB host, branch, LOCAL / PREVIEW / PRODUCTION.
 * Mirror of scripts/env-shared.mjs for TypeScript imports.
 */

export type AffisellEnvLabel = "LOCAL" | "PREVIEW" | "PRODUCTION"
export type NeonBranchLabel = "staging" | "production" | "local" | "unknown"

export type DbEnvInfo = {
  env: AffisellEnvLabel
  vercelEnv: string
  isProd: boolean
  isStaging: boolean
  isLocal: boolean
  host: string
  dbHost: string
  branch: NeonBranchLabel
  dbBranch: NeonBranchLabel
  endpointId: string
  pooling: boolean
}

const NEON_HOST_RE = /\.(?:aws\.)?neon\.tech$/i
const LOCAL_DB_RE = /^(localhost|127\.0\.0\.1)$/i
const PROD_NEON_MARKER = "misty-sea"
const STAGING_NEON_MARKER = "shy-wind"

type ParsedDbUrl = {
  host: string
  maskedHost: string
  branch: NeonBranchLabel
  endpointId: string
  isLocalhost: boolean
  isNeon: boolean
  pooling: boolean
}

export function resolveAffisellEnv(): AffisellEnvLabel {
  const vercel = process.env.VERCEL_ENV?.trim().toLowerCase()
  if (vercel === "production") return "PRODUCTION"
  if (vercel === "preview") return "PREVIEW"
  if (process.env.NODE_ENV === "production" && !vercel) return "PRODUCTION"
  return "LOCAL"
}

export function resolveDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.DATABASE_URL_STAGING?.trim() ||
    ""
  )
}

export function extractHostFromDatabaseUrl(rawUrl: string | undefined | null): string {
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

export function resolveNeonBranchFromHost(host: string): NeonBranchLabel {
  const h = host.toLowerCase()
  if (!h) return "unknown"
  if (LOCAL_DB_RE.test(h)) return "local"
  if (h.includes(STAGING_NEON_MARKER)) return "staging"
  if (h.includes(PROD_NEON_MARKER)) return "production"
  if (NEON_HOST_RE.test(h)) return "unknown"
  return "local"
}

export function isPoolerHost(host: string): boolean {
  return /-pooler\./i.test(host)
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

export function previewPointsAtProdDb(databaseUrl?: string): boolean {
  if (process.env.VERCEL_ENV?.trim().toLowerCase() !== "preview") return false
  const url = databaseUrl?.trim() || resolveDatabaseUrl()
  if (!url) return false
  const host = extractHostFromDatabaseUrl(url).toLowerCase()
  return host.includes(PROD_NEON_MARKER)
}

export class PreviewProductionDatabaseError extends Error {
  readonly client: string

  constructor(client: string, maskedHost: string) {
    super(
      `[env-guard] This is a Vercel PREVIEW deployment and the ${client} database URL names the PRODUCTION database (${maskedHost}). ` +
        `The client is not created: a Preview must never read or write production data. Point this variable at the staging branch ` +
        `(ep-shy-wind-…) in Vercel → Environment Variables → Preview, or remove it. The URL itself is not shown.`
    )
    this.name = "PreviewProductionDatabaseError"
    this.client = client
  }
}

/**
 * RUNTIME guard (finalisation master K1): a Vercel Preview whose database URL names the production endpoint refuses to create the
 * database client — so every query fails, loudly, instead of silently serving or modifying production data. Until now
 * `previewPointsAtProdDb` was only used by the `env:check` script and the build pipeline (`scripts/schema-deploy.mjs`); a deployment
 * could still start with the wrong variable (changed in the dashboard, copied from Production) and run.
 *
 * Applied in `lib/prisma.ts` (default and fulfillment clients) and `lib/prisma-radar.ts`. Inert outside `VERCEL_ENV=preview`, so
 * production, local development and tests are unaffected. Never prints the URL: only the masked endpoint.
 */
export function assertPreviewNotOnProductionDatabase(databaseUrl: string | undefined | null, client: string): void {
  const url = databaseUrl?.trim()
  if (!url) return
  if (!previewPointsAtProdDb(url)) return
  const maskedHost = maskDbHost(extractHostFromDatabaseUrl(url))
  console.error("[env-guard]", { result: "preview_points_at_production_database", client, host: maskedHost })
  throw new PreviewProductionDatabaseError(client, maskedHost)
}

/** Current Affisell environment + masked DB metadata (safe to log). */
export function getDbEnv(databaseUrl?: string): DbEnvInfo {
  const env = resolveAffisellEnv()
  const vercelEnv = process.env.VERCEL_ENV?.trim() || "local"
  const url = databaseUrl?.trim() || resolveDatabaseUrl()
  const parsed = parseDatabaseUrl(url)

  return {
    env,
    vercelEnv,
    isProd: parsed.branch === "production",
    isStaging: parsed.branch === "staging",
    isLocal: env === "LOCAL" || parsed.branch === "local",
    host: parsed.maskedHost,
    dbHost: parsed.maskedHost,
    branch: parsed.branch,
    dbBranch: parsed.branch,
    endpointId: parsed.endpointId,
    pooling: parsed.pooling,
  }
}

/** Log once at Prisma client boot — no query interception. */
export function logDbEnvBoot(databaseUrl?: string): void {
  const info = getDbEnv(databaseUrl)
  console.log("[db]", {
    env: info.env,
    host: info.host,
    branch: info.branch,
    pooling: info.pooling,
    isProd: info.isProd,
    isStaging: info.isStaging,
    isLocal: info.isLocal,
  })
}

/**
 * Normalize Neon pooler URL for Prisma (avoids P2024 pool exhaustion in Next.js dev).
 * @see https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
 */

const POOLER_HOST_RE = /-pooler\./i
const NEON_HOST_RE = /\.aws\.neon\.tech$/i

export type PrismaPoolParams = {
  pgbouncer?: string
  connection_limit?: string
  pool_timeout?: string
  connect_timeout?: string
}

function defaultPoolParams(): PrismaPoolParams {
  const isProd = process.env.NODE_ENV === "production"
  return {
    pgbouncer: "true",
    // Dev: parallel RSC/API routes; 5 connections is too low (P2024).
    connection_limit: process.env.PRISMA_CONNECTION_LIMIT?.trim() || (isProd ? "10" : "20"),
    pool_timeout: process.env.PRISMA_POOL_TIMEOUT?.trim() || (isProd ? "30" : "60"),
    connect_timeout: process.env.PRISMA_CONNECT_TIMEOUT?.trim() || (isProd ? "15" : "30"),
  }
}

const DEV_MIN_CONNECTION_LIMIT = 15

function mergePoolParam(url: URL, key: keyof PrismaPoolParams, value: string | undefined) {
  if (!value) return
  const existing = url.searchParams.get(key)
  if (!existing) {
    url.searchParams.set(key, value)
    return
  }
  if (process.env.NODE_ENV === "development" && key === "connection_limit") {
    const n = Number(existing)
    if (Number.isFinite(n) && n < DEV_MIN_CONNECTION_LIMIT) {
      url.searchParams.set(key, value)
    }
  }
}

/** ep-xxx.region.neon.tech → ep-xxx-pooler.region.neon.tech (Neon pooled endpoint). */
export function neonDirectHostToPooler(hostname: string): string | null {
  if (POOLER_HOST_RE.test(hostname) || !NEON_HOST_RE.test(hostname)) return null
  const match = hostname.match(/^(ep-[^.]+)(\..+)$/i)
  if (!match?.[1] || !match[2]) return null
  return `${match[1]}-pooler${match[2]}`
}

function isNeonPoolerUrl(url: URL): boolean {
  return url.searchParams.get("pgbouncer") === "true" || POOLER_HOST_RE.test(url.hostname)
}

/** Apply pool params when using Neon pooler (or explicit pgbouncer=true). Dev: tune Postgres URLs. */
export function augmentPrismaDatasourceUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return trimmed

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return trimmed
  }

  const isDev = process.env.NODE_ENV === "development"
  const usePooler = isNeonPoolerUrl(url)
  if (!usePooler && !isDev) return trimmed

  const defaults = defaultPoolParams()

  if (usePooler) {
    for (const [key, value] of Object.entries(defaults)) {
      mergePoolParam(url, key as keyof PrismaPoolParams, value)
    }
    return url.toString()
  }

  // Direct Neon / local Postgres in dev — never force pgbouncer=true on a direct host.
  mergePoolParam(url, "connection_limit", defaults.connection_limit)
  mergePoolParam(url, "pool_timeout", defaults.pool_timeout)
  mergePoolParam(url, "connect_timeout", defaults.connect_timeout)
  return url.toString()
}

/** Prefer Neon pooler in production; dev defaults to direct host (fewer E57P01 idle drops). */
export function normalizePrismaRawUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return trimmed

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return trimmed
  }

  const isDev = process.env.NODE_ENV === "development"
  const forcePoolerInDev = isDev && process.env.PRISMA_USE_POOLER_DEV === "1"
  const useDirectInDev = isDev && process.env.PRISMA_USE_DIRECT_DEV === "1"
  if (useDirectInDev || isNeonPoolerUrl(url) || (isDev && !forcePoolerInDev)) {
    return trimmed
  }

  const poolerHost = neonDirectHostToPooler(url.hostname)
  if (!poolerHost) return trimmed

  url.hostname = poolerHost
  if (url.searchParams.get("pgbouncer") !== "true") {
    url.searchParams.set("pgbouncer", "true")
  }
  return url.toString()
}

export function getPrismaDatasourceUrl(): string {
  const isDev = process.env.NODE_ENV === "development"
  const poolerForced = isDev && process.env.PRISMA_USE_POOLER_DEV === "1"
  const directExplicit = isDev && process.env.PRISMA_USE_DIRECT_DEV === "1"
  const unpooled =
    process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DIRECT_URL?.trim()

  let raw = process.env.DATABASE_URL?.trim()
  if (!raw) {
    throw new Error("DATABASE_URL is not set")
  }

  if (isDev && !poolerForced && (directExplicit || unpooled)) {
    raw = unpooled ?? raw
  }

  return augmentPrismaDatasourceUrl(normalizePrismaRawUrl(raw))
}

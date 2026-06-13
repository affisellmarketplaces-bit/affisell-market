/**
 * Normalize Neon pooler URL for Prisma (avoids P2024 pool exhaustion in Next.js dev).
 * @see https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
 */

const POOLER_HOST_RE = /-pooler\./i

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
    connect_timeout: process.env.PRISMA_CONNECT_TIMEOUT?.trim() || "15",
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

/** Apply pool params when using Neon pooler (or explicit pgbouncer=true). Dev: tune all Postgres URLs. */
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
  const usePooler =
    url.searchParams.get("pgbouncer") === "true" || POOLER_HOST_RE.test(url.hostname)
  if (!usePooler && !isDev) return trimmed

  const defaults = defaultPoolParams()
  for (const [key, value] of Object.entries(defaults)) {
    mergePoolParam(url, key as keyof PrismaPoolParams, value)
  }
  return url.toString()
}

export function getPrismaDatasourceUrl(): string {
  const isDev = process.env.NODE_ENV === "development"
  const useDirectInDev =
    isDev && process.env.PRISMA_USE_DIRECT_DEV === "1" && process.env.DIRECT_URL?.trim()
  const raw = (useDirectInDev ? process.env.DIRECT_URL : process.env.DATABASE_URL)?.trim()
  if (!raw) {
    throw new Error("DATABASE_URL is not set")
  }
  return augmentPrismaDatasourceUrl(raw)
}

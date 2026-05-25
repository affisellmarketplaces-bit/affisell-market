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
    connection_limit: process.env.PRISMA_CONNECTION_LIMIT?.trim() || (isProd ? "10" : "15"),
    pool_timeout: process.env.PRISMA_POOL_TIMEOUT?.trim() || "30",
    connect_timeout: process.env.PRISMA_CONNECT_TIMEOUT?.trim() || "15",
  }
}

/** Apply pool params when using Neon pooler (or explicit pgbouncer=true). */
export function augmentPrismaDatasourceUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return trimmed

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return trimmed
  }

  const usePooler =
    url.searchParams.get("pgbouncer") === "true" || POOLER_HOST_RE.test(url.hostname)
  if (!usePooler) return trimmed

  const defaults = defaultPoolParams()
  for (const [key, value] of Object.entries(defaults)) {
    if (value && !url.searchParams.has(key)) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

export function getPrismaDatasourceUrl(): string {
  const raw = process.env.DATABASE_URL?.trim()
  if (!raw) {
    throw new Error("DATABASE_URL is not set")
  }
  return augmentPrismaDatasourceUrl(raw)
}

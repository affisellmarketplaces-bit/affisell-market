import { PrismaClient } from "@prisma/client"

import { getPrismaDatasourceUrl } from "@/lib/prisma-datasource-url"

const PRISMA_RETRYABLE = new Set(["P1017", "P2024", "P1001"])

type PrismaGlobal = typeof globalThis & {
  __affisellPrisma?: PrismaClient
  __affisellPrismaUrl?: string
}

const globalForPrisma = globalThis as PrismaGlobal

function prismaErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code: string }).code)
  }
  return ""
}

function createPrismaClient(): PrismaClient {
  const url = getPrismaDatasourceUrl()
  globalForPrisma.__affisellPrismaUrl = url

  return new PrismaClient({
    datasources: { db: { url } },
    log:
      process.env.PRISMA_LOG === "1"
        ? ["error", "warn", "query"]
        : process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : [],
  })
}

function assertPrismaServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "[prisma] PrismaClient is server-only — import query constants from @/lib/marketplace-query-params in client components"
    )
  }
}

/** Singleton — one engine per Node process (dev HMR + prod server). */
function getPrismaSingleton(): PrismaClient {
  assertPrismaServerOnly()
  const url = getPrismaDatasourceUrl()
  const cached = globalForPrisma.__affisellPrisma

  if (cached && globalForPrisma.__affisellPrismaUrl === url) {
    return cached
  }

  if (cached) {
    void cached.$disconnect().catch(() => {})
  }

  const client = createPrismaClient()
  globalForPrisma.__affisellPrisma = client
  return client
}

/** Lazy proxy — avoids reading DATABASE_URL when the module is evaluated in the browser bundle. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaSingleton()
    const value = Reflect.get(client, prop, client) as unknown
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client)
    }
    return value
  },
})

/** Warm pool on server boot (instrumentation). */
export async function connectPrismaWithRetry(): Promise<void> {
  try {
    await prisma.$connect()
  } catch (e) {
    console.warn("[prisma] $connect:", e)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry transient Neon / pool errors (P1017 disconnect, P2024 pool timeout).
 */
export async function withPrismaReconnect<T>(
  fn: () => Promise<T>,
  options?: { retries?: number }
): Promise<T> {
  const maxRetries = options?.retries ?? 2
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const code = prismaErrorCode(error)
      if (!PRISMA_RETRYABLE.has(code) || attempt >= maxRetries) {
        throw error
      }
      const delayMs = 40 * (attempt + 1) ** 2
      console.warn(`[prisma] ${code} — retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`)
      await sleep(delayMs)
      try {
        await prisma.$connect()
      } catch {
        /* next attempt may still succeed */
      }
    }
  }

  throw lastError
}

export default prisma

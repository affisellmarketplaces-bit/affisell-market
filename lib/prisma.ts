if (typeof window !== "undefined") {
  throw new Error("PrismaClient cannot be used in the browser")
}

import { Prisma, PrismaClient } from "@prisma/client"

import {
  isRetryablePrismaConnectionError,
  prismaErrorCode,
} from "@/lib/prisma-connection-error"
import { getPrismaDatasourceUrl } from "@/lib/prisma-datasource-url"

type PrismaGlobal = typeof globalThis & {
  __affisellPrisma?: PrismaClient
  __affisellPrismaUrl?: string
}

const globalForPrisma = globalThis as PrismaGlobal

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createBasePrismaClient(): PrismaClient {
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

function modelDelegateKey(model: string): string {
  if (!model) return ""
  return model.charAt(0).toLowerCase() + model.slice(1)
}

type QueryExtensionArgs = {
  model: string
  operation: string
  args: unknown
  query: (args: unknown) => Promise<unknown>
}

async function runQueryOnFreshClient({
  model,
  operation,
  args,
}: Omit<QueryExtensionArgs, "query">): Promise<unknown> {
  const client = getPrismaSingleton() as PrismaClient & Record<string, unknown>
  const key = modelDelegateKey(model)

  if (!key) {
    const rootOp = client[operation]
    if (typeof rootOp === "function") {
      return (rootOp as (a: unknown) => Promise<unknown>).call(client, args)
    }
    throw new Error(`[prisma] unknown root operation ${operation}`)
  }

  const delegate = client[key] as Record<string, (a: unknown) => Promise<unknown>> | undefined
  const op = delegate?.[operation]
  if (!op) {
    throw new Error(`[prisma] unknown delegate ${key}.${operation}`)
  }
  return op.call(delegate, args)
}

function retryDelayMs(error: unknown, attempt: number): number {
  const code = prismaErrorCode(error)
  if (code === "P2024") return 150 * (attempt + 1) ** 2
  return 50 * (attempt + 1) ** 2
}

/** P2024 = pool starved — disconnecting the engine makes contention worse. */
function shouldResetPrismaEngine(error: unknown): boolean {
  const code = prismaErrorCode(error)
  if (code === "P2024") return false
  return isRetryablePrismaConnectionError(error)
}

async function executeWithReconnect({
  model,
  operation,
  args,
  query,
}: QueryExtensionArgs): Promise<unknown> {
  const maxRetries = 2
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt === 0) {
        return await query(args)
      }
      return await runQueryOnFreshClient({ model, operation, args })
    } catch (error) {
      lastError = error
      if (!isRetryablePrismaConnectionError(error) || attempt >= maxRetries) {
        throw error
      }
      const delayMs = retryDelayMs(error, attempt)
      console.warn(
        `[prisma] ${prismaErrorCode(error) || "connection"} — ${shouldResetPrismaEngine(error) ? "reset & " : ""}retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`
      )
      if (shouldResetPrismaEngine(error)) {
        await resetPrismaClient()
      }
      await sleep(delayMs)
      try {
        await getPrismaSingleton().$connect()
      } catch {
        /* next attempt may still succeed */
      }
    }
  }

  throw lastError
}

function createPrismaClient(): PrismaClient {
  const base = createBasePrismaClient()
  const extended = base.$extends({
    name: "affisell-reconnect",
    query: {
      $allModels: {
        async $allOperations(ctx) {
          return executeWithReconnect({
            model: ctx.model,
            operation: ctx.operation,
            args: ctx.args,
            query: ctx.query,
          })
        },
      },
      async $queryRaw(ctx) {
        return executeWithReconnect({
          model: "",
          operation: "$queryRaw",
          args: ctx.args,
          query: ctx.query,
        })
      },
      async $executeRaw(ctx) {
        return executeWithReconnect({
          model: "",
          operation: "$executeRaw",
          args: ctx.args,
          query: ctx.query,
        })
      },
    },
  })
  return extended as unknown as PrismaClient
}

function assertPrismaServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "[prisma] PrismaClient is server-only — import query constants from @/lib/marketplace-query-params in client components"
    )
  }
}

/** Drop cached engine after pooler/admin disconnect (E57P01 / P1017). */
export async function resetPrismaClient(): Promise<void> {
  const cached = globalForPrisma.__affisellPrisma
  globalForPrisma.__affisellPrisma = undefined
  if (!cached) return
  try {
    await cached.$disconnect()
  } catch {
    /* stale socket */
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
  const maxAttempts = 3
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await prisma.$connect()
      await prisma.$queryRaw(Prisma.sql`SELECT 1`)
      return
    } catch (e) {
      if (!isRetryablePrismaConnectionError(e) || attempt >= maxAttempts - 1) {
        console.warn("[prisma] $connect:", e)
        return
      }
      console.warn(`[prisma] warm connect retry ${attempt + 1}/${maxAttempts - 1}`)
      await resetPrismaClient()
      await sleep(80 * (attempt + 1))
    }
  }
}

/**
 * Retry transient Neon / pool errors (P1017, P2024, E57P01 admin terminate).
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
      if (!isRetryablePrismaConnectionError(error) || attempt >= maxRetries) {
        throw error
      }
      const delayMs = retryDelayMs(error, attempt)
      console.warn(
        `[prisma] ${prismaErrorCode(error) || "connection"} — ${shouldResetPrismaEngine(error) ? "reset & " : ""}retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`
      )
      if (shouldResetPrismaEngine(error)) {
        await resetPrismaClient()
      }
      await sleep(delayMs)
      try {
        await getPrismaSingleton().$connect()
      } catch {
        /* next attempt */
      }
    }
  }

  throw lastError
}

export default prisma

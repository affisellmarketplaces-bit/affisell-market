if (typeof window !== "undefined") {
  throw new Error("PrismaClient cannot be used in the browser")
}

import { Prisma, PrismaClient } from "@prisma/client"

import {
  isRetryablePrismaConnectionError,
  prismaErrorCode,
} from "@/lib/prisma-connection-error"
import {
  clearPrismaCircuit,
  isPrismaCircuitOpen,
  notePrismaUnreachable,
} from "@/lib/prisma-circuit-breaker"
import { getPrismaDatasourceUrl, getPrismaDirectDatasourceUrl } from "@/lib/prisma-datasource-url"
import { logDbEnvBoot } from "@/lib/db-env"

type PrismaGlobal = typeof globalThis & {
  __affisellPrisma?: PrismaClient
  __affisellPrismaUrl?: string
  __affisellFulfillmentPrisma?: PrismaClient
  __affisellFulfillmentPrismaUrl?: string
}

const globalForPrisma = globalThis as PrismaGlobal

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createBasePrismaClient(url: string, logLabel: "default" | "fulfillment" = "default"): PrismaClient {
  const useEventLogs =
    process.env.PRISMA_LOG !== "1" && process.env.NODE_ENV === "development"

  const client = new PrismaClient({
    datasources: { db: { url } },
    log: useEventLogs
      ? [
          { emit: "event", level: "error" },
          { emit: "event", level: "warn" },
        ]
      : process.env.PRISMA_LOG === "1"
        ? ["error", "warn", "query"]
        : process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : [],
  })

  if (useEventLogs) {
    client.$on("error", (event) => {
      const msg = event.message
      // Idle pool drops look like "kind: Closed" and also match retryable regex —
      // must not tear down the singleton (storm under parallel RSC).
      if (
        /kind:\s*Closed|postgresql connection.*closed/i.test(msg) &&
        !/E57P01|administrator command|P1017/i.test(msg)
      ) {
        schedulePrismaClientReset("closed")
        return
      }
      if (isRetryablePrismaConnectionError(event)) {
        schedulePrismaClientReset("retryable")
        return
      }
      console.error("prisma:error", msg)
    })
    client.$on("warn", (event) => {
      console.warn("prisma:warn", event.message)
    })
  }

  try {
    const host = new URL(url).hostname
    logDbEnvBoot(url)
    console.log("[prisma]", {
      result: "client_created",
      host,
      pooler: /-pooler\./i.test(host),
      client: logLabel,
    })
  } catch {
    /* ignore bad URL parse — create already has datasources url */
  }

  return client
}

function createDefaultBasePrismaClient(): PrismaClient {
  const url = getPrismaDatasourceUrl()
  globalForPrisma.__affisellPrismaUrl = url
  return createBasePrismaClient(url, "default")
}

type QueryExtensionArgs = {
  model: string
  operation: string
  args: unknown
  query: (args: unknown) => Promise<unknown>
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
  if (isPrismaCircuitOpen()) {
    throw new Error("Database temporarily unreachable — retry in a few seconds.")
  }

  const maxRetries = 2
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Always use ctx.query — never delegate through the extended client on retry
      // (that re-enters $allOperations and causes "Maximum call stack size exceeded").
      const result = await query(args)
      clearPrismaCircuit()
      return result
    } catch (error) {
      lastError = error
      notePrismaUnreachable(error)
      if (!isRetryablePrismaConnectionError(error) || attempt >= maxRetries || isPrismaCircuitOpen()) {
        throw error
      }
      const delayMs = retryDelayMs(error, attempt)
      console.warn(
        `[prisma] ${prismaErrorCode(error) || "connection"} — ${shouldResetPrismaEngine(error) ? "reset & " : ""}retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`
      )
      if (shouldResetPrismaEngine(error)) {
        lastScheduledResetAt = Date.now()
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

function createPrismaClient(baseFactory: () => PrismaClient): PrismaClient {
  const base = baseFactory()
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
let resetInFlight: Promise<void> | null = null
/** Coalesce engine teardown — parallel Next RSC used to storm $disconnect on idle Closed. */
let lastScheduledResetAt = 0
let lastIdleClosedLogAt = 0
const RESET_COALESCE_MS = 5_000
const IDLE_CLOSED_LOG_MS = 15_000

/**
 * Idle `kind: Closed` engine events must NOT tear down the singleton (cascades under load).
 * Hard / query-path disconnects still reset, but at most once per coalesce window.
 */
export function schedulePrismaClientReset(
  reason: "retryable" | "closed" | "query"
): void {
  const now = Date.now()
  if (reason === "closed") {
    if (now - lastIdleClosedLogAt >= IDLE_CLOSED_LOG_MS) {
      lastIdleClosedLogAt = now
      console.warn("[prisma] idle connection closed — lazy reconnect on next query")
    }
    return
  }
  if (now - lastScheduledResetAt < RESET_COALESCE_MS) {
    return
  }
  lastScheduledResetAt = now
  console.warn("[prisma] transient DB disconnect — will reconnect on next query", { reason })
  void resetPrismaClient()
}

/** @internal tests */
export function __resetPrismaResetCoalesceStateForTests(): void {
  lastScheduledResetAt = 0
  lastIdleClosedLogAt = 0
}

export async function resetPrismaClient(): Promise<void> {
  if (resetInFlight) return resetInFlight
  resetInFlight = (async () => {
    const cached = globalForPrisma.__affisellPrisma
    globalForPrisma.__affisellPrisma = undefined
    if (!cached) return
    try {
      await cached.$disconnect()
    } catch {
      /* stale socket */
    }
  })().finally(() => {
    resetInFlight = null
  })
  return resetInFlight
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

  const client = createPrismaClient(createDefaultBasePrismaClient)
  globalForPrisma.__affisellPrisma = client
  return client
}

/** Direct Neon URL for fulfillment writes — falls back to pooled singleton when unset. */
function getFulfillmentPrismaSingleton(): PrismaClient {
  assertPrismaServerOnly()
  const directUrl = getPrismaDirectDatasourceUrl()
  if (!directUrl) {
    return getPrismaSingleton()
  }

  const cached = globalForPrisma.__affisellFulfillmentPrisma
  if (cached && globalForPrisma.__affisellFulfillmentPrismaUrl === directUrl) {
    return cached
  }

  if (cached) {
    void cached.$disconnect().catch(() => {})
  }

  globalForPrisma.__affisellFulfillmentPrismaUrl = directUrl
  const client = createPrismaClient(() => createBasePrismaClient(directUrl, "fulfillment"))
  globalForPrisma.__affisellFulfillmentPrisma = client
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

/** FulfillmentGroup / FulfillmentItem writes — prefers DATABASE_URL_UNPOOLED (direct Neon). */
export const fulfillmentPrisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getFulfillmentPrismaSingleton()
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
  if (isPrismaCircuitOpen()) {
    throw new Error("Database temporarily unreachable — retry in a few seconds.")
  }

  const maxRetries = options?.retries ?? 2
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn()
      clearPrismaCircuit()
      return result
    } catch (error) {
      lastError = error
      notePrismaUnreachable(error)
      if (!isRetryablePrismaConnectionError(error) || attempt >= maxRetries || isPrismaCircuitOpen()) {
        throw error
      }
      const delayMs = retryDelayMs(error, attempt)
      console.warn(
        `[prisma] ${prismaErrorCode(error) || "connection"} — ${shouldResetPrismaEngine(error) ? "reset & " : ""}retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`
      )
      if (shouldResetPrismaEngine(error)) {
        lastScheduledResetAt = Date.now()
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

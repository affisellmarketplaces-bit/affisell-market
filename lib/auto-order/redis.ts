import IORedis from "ioredis"

let sharedConnection: IORedis | null = null
let lastRedisErrorLogAt = 0

function attachRedisErrorHandler(conn: IORedis): void {
  const tagged = conn as IORedis & { __affisellErrorHandler?: boolean }
  if (tagged.__affisellErrorHandler) return
  tagged.__affisellErrorHandler = true
  conn.on("error", (err) => {
    const now = Date.now()
    if (now - lastRedisErrorLogAt < 30_000) return
    lastRedisErrorLogAt = now
    console.warn("[redis]", err instanceof Error ? err.message : String(err))
  })
}

export function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim()
  return url && url.length > 0 ? url : null
}

export function isAutoOrderQueueEnabled(): boolean {
  return getRedisUrl() != null && process.env.AUTO_ORDER_ENABLED !== "false"
}

let warnedMissingUrl = false

/**
 * Soft client — returns null when REDIS_URL is missing (logs once).
 * Use for Radar cron / optional paths so the app does not crash.
 */
export function tryGetRedisConnection(): IORedis | null {
  const url = getRedisUrl()
  if (!url) {
    if (!warnedMissingUrl) {
      warnedMissingUrl = true
      console.warn("[redis]", {
        result: "REDIS_URL_missing",
        message: "Returning null client — caller must fall back",
      })
    }
    return null
  }
  try {
    return getRedisConnection()
  } catch (err) {
    console.warn("[redis]", {
      result: "client_error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return null
  }
}

/** Singleton for BullMQ producers (Next.js server). Throws if REDIS_URL missing. */
export function getRedisConnection(): IORedis {
  const url = getRedisUrl()
  if (!url) throw new Error("REDIS_URL is not configured")
  if (!sharedConnection) {
    sharedConnection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    })
    attachRedisErrorHandler(sharedConnection)
  }
  return sharedConnection
}

/** Fresh connection for BullMQ workers (blocking commands). */
export function createRedisConnection(): IORedis {
  const url = getRedisUrl()
  if (!url) throw new Error("REDIS_URL is not configured")
  const conn = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  })
  attachRedisErrorHandler(conn)
  return conn
}

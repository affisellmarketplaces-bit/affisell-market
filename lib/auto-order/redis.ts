import IORedis from "ioredis"

let sharedConnection: IORedis | null = null

export function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim()
  return url && url.length > 0 ? url : null
}

export function isAutoOrderQueueEnabled(): boolean {
  return getRedisUrl() != null && process.env.AUTO_ORDER_ENABLED !== "false"
}

/** Singleton for BullMQ producers (Next.js server). */
export function getRedisConnection(): IORedis {
  const url = getRedisUrl()
  if (!url) throw new Error("REDIS_URL is not configured")
  if (!sharedConnection) {
    sharedConnection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    })
  }
  return sharedConnection
}

/** Fresh connection for BullMQ workers (blocking commands). */
export function createRedisConnection(): IORedis {
  const url = getRedisUrl()
  if (!url) throw new Error("REDIS_URL is not configured")
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  })
}

import "server-only"

import type IORedis from "ioredis"

import { tryGetRedisConnection, getRedisUrl } from "@/lib/auto-order/redis"

/**
 * Soft Redis accessor for Radar — never throws for missing REDIS_URL.
 * Returns null and relies on tryGetRedisConnection warning; callers fall back.
 */
export function tryGetRedisClient(): IORedis | null {
  return tryGetRedisConnection()
}

export function isRadarRedisConfigured(): boolean {
  return Boolean(getRedisUrl())
}

export { getRedisUrl }

import "server-only"

import { randomBytes } from "node:crypto"

import { getRedisConnection, getRedisUrl } from "@/lib/auto-order/redis"
import { isRadarEnabled, requireRedis } from "@/lib/radar/gate"

type OAuthStatePayload = { userId: string; nonce: string }

const OAUTH_STATE_TTL_SEC = 600

const memoryStates = new Map<string, { payload: OAuthStatePayload; expiresAt: number }>()

function pruneMemoryStates(): void {
  const now = Date.now()
  for (const [k, v] of memoryStates) {
    if (v.expiresAt < now) memoryStates.delete(k)
  }
}

function keyFor(state: string): string {
  return `radar:oauth:state:${state}`
}

function parseStateUserId(state: string): string {
  const dot = state.indexOf(".")
  if (dot <= 0 || dot >= state.length - 1) {
    throw new Error("Invalid OAuth state format")
  }
  const userIdFromState = state.slice(dot + 1).trim()
  if (!userIdFromState) throw new Error("Invalid OAuth state user")
  return userIdFromState
}

/** Shared OAuth state — Redis required when RADAR_ENABLED=true (same contract as TikTok P0). */
export async function createRadarOAuthState(userId: string): Promise<string> {
  requireRedis()

  const nonce = randomBytes(16).toString("hex")
  const state = `${nonce}.${userId}`
  const key = keyFor(state)
  const payload: OAuthStatePayload = { userId, nonce }

  if (getRedisUrl()) {
    const redis = getRedisConnection()
    await redis.setex(key, OAUTH_STATE_TTL_SEC, JSON.stringify(payload))
    return state
  }

  console.warn(
    "[radar/oauth] REDIS_URL missing — using in-memory OAuth state (dev only; multi-instance unsafe)"
  )
  pruneMemoryStates()
  memoryStates.set(key, {
    payload,
    expiresAt: Date.now() + OAUTH_STATE_TTL_SEC * 1000,
  })
  return state
}

export async function verifyRadarOAuthState(state: string): Promise<string> {
  requireRedis()

  const userIdFromState = parseStateUserId(state)
  const key = keyFor(state)

  if (getRedisUrl()) {
    const redis = getRedisConnection()
    const raw = await redis.get(key)
    await redis.del(key)
    if (!raw) throw new Error("Invalid or expired OAuth state")

    let stateData: OAuthStatePayload
    try {
      stateData = JSON.parse(raw) as OAuthStatePayload
    } catch {
      throw new Error("Invalid OAuth state payload")
    }

    if (!stateData.userId || stateData.userId !== userIdFromState) {
      throw new Error("State user mismatch")
    }
    return stateData.userId
  }

  if (isRadarEnabled()) {
    throw new Error("REDIS_URL required when RADAR_ENABLED=true")
  }

  const entry = memoryStates.get(key)
  memoryStates.delete(key)
  if (!entry || entry.expiresAt < Date.now()) {
    throw new Error("Invalid or expired OAuth state")
  }
  if (entry.payload.userId !== userIdFromState) {
    throw new Error("State user mismatch")
  }
  return entry.payload.userId
}

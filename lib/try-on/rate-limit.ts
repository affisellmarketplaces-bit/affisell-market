import "server-only"

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

import { rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { isAffisellPlusUser } from "@/lib/try-on/is-affisell-plus"
import { clientIpFromRequest } from "@/lib/logger"
import { hashClientIp } from "@/lib/try-on/result-hash"
import { prisma } from "@/lib/prisma"

type RateLimitUser = {
  id: string
  role?: string | null
  isPro?: boolean | null
  stripeSubscriptionId?: string | null
}

function upstashRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null
  return new Redis({ url, token })
}

let minuteLimiter: Ratelimit | null = null
let dayLimiter: Ratelimit | null = null

function getMinuteLimiter(): Ratelimit | null {
  if (minuteLimiter) return minuteLimiter
  const redis = upstashRedis()
  if (!redis) return null
  minuteLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "tryon:min",
    analytics: true,
  })
  return minuteLimiter
}

function getDayLimiter(): Ratelimit | null {
  if (dayLimiter) return dayLimiter
  const redis = upstashRedis()
  if (!redis) return null
  dayLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 d"),
    prefix: "tryon:day",
    analytics: true,
  })
  return dayLimiter
}

export type TryOnRateLimitResult =
  | { ok: true }
  | { ok: false; status: 429; message: string; retryAfterSec?: number }

/** Anonymous: 1 lifetime try (cookie + IP hash). Logged-in: 5/min + 10/day. Plus: unlimited. */
export async function enforceTryOnRateLimit(input: {
  req: Request
  user: RateLimitUser | null
  anonId: string | null
}): Promise<TryOnRateLimitResult> {
  if (input.user && isAffisellPlusUser(input.user)) {
    return { ok: true }
  }

  const ip = clientIpFromRequest(input.req)
  const ipHash = hashClientIp(ip)

  if (!input.user) {
    const anonKey = input.anonId?.trim()
    const prior = await prisma.tryOnJob.count({
      where: {
        OR: [...(anonKey ? [{ anonId: anonKey }] : []), { ipHash }],
      },
    })
    if (prior >= 1) {
      console.log("[try-on]", { result: "anon_quota_exceeded", anonId: anonKey, ipHash })
      return {
        ok: false,
        status: 429,
        message: "Free try-on limit reached. Sign in for more tries or upgrade to Affisell+.",
      }
    }
    return { ok: true }
  }

  const userKey = `user:${input.user.id}`
  const minute = getMinuteLimiter()
  const day = getDayLimiter()

  if (minute && day) {
    const [minRes, dayRes] = await Promise.all([
      minute.limit(userKey),
      day.limit(userKey),
    ])
    if (!minRes.success) {
      return {
        ok: false,
        status: 429,
        message: "Too many try-on requests. Please wait a minute.",
        retryAfterSec: Math.max(1, Math.ceil((minRes.reset - Date.now()) / 1000)),
      }
    }
    if (!dayRes.success) {
      return {
        ok: false,
        status: 429,
        message: "Daily try-on limit reached (10/day). Upgrade to Affisell+ for unlimited.",
        retryAfterSec: Math.max(1, Math.ceil((dayRes.reset - Date.now()) / 1000)),
      }
    }
    return { ok: true }
  }

  const limitedMin = await rateLimitResponseAsync(userKey, {
    prefix: "tryon-min",
    limit: 5,
    windowMs: 60_000,
  })
  if (limitedMin) {
    return { ok: false, status: 429, message: "Too many try-on requests. Please wait a minute." }
  }

  const limitedDay = await rateLimitResponseAsync(userKey, {
    prefix: "tryon-day",
    limit: 10,
    windowMs: 24 * 60 * 60 * 1000,
  })
  if (limitedDay) {
    return {
      ok: false,
      status: 429,
      message: "Daily try-on limit reached (10/day). Upgrade to Affisell+ for unlimited.",
    }
  }

  return { ok: true }
}

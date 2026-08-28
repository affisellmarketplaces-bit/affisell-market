import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { HumanoidShield } from "@/lib/security/humanoid-shield"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ShieldLogEntry = {
  ts: string
  ip: string
  type: string
  path: string
  data: unknown
}

declare global {
  // eslint-disable-next-line no-var
  var __shieldLogs: ShieldLogEntry[] | undefined
}

const MAX_LOGS = 500

function getMemoryLogs(): ShieldLogEntry[] {
  if (!globalThis.__shieldLogs) globalThis.__shieldLogs = []
  return globalThis.__shieldLogs
}

function pushLog(entry: ShieldLogEntry): void {
  const logs = getMemoryLogs()
  logs.unshift(entry)
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS
}

async function readRedisLogs(limit: number): Promise<ShieldLogEntry[] | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL?.trim()) return null
  try {
    const { Redis } = await import("@upstash/redis")
    const redis = Redis.fromEnv()
    const raw = await redis.lrange("affisell:shield:logs", 0, limit - 1)
    if (!Array.isArray(raw)) return null
    return raw
      .map((item) => {
        if (typeof item === "string") {
          try {
            return JSON.parse(item) as ShieldLogEntry
          } catch {
            return null
          }
        }
        return item as ShieldLogEntry
      })
      .filter((x): x is ShieldLogEntry => Boolean(x))
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const ip = HumanoidShield.extractIp(req as NextRequest)
  console.log("[shield-client]", { step: "logs_get", ip })

  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), MAX_LOGS)

  const redisLogs = await readRedisLogs(limit)
  const logs = redisLogs ?? getMemoryLogs().slice(0, limit)

  return NextResponse.json({ logs, count: logs.length, source: redisLogs ? "redis" : "memory" })
}

export async function POST(req: Request) {
  const ip = HumanoidShield.extractIp(req as NextRequest)
  let body: { type?: unknown; data?: unknown; path?: unknown } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const type = typeof body.type === "string" ? body.type.slice(0, 64) : "UNKNOWN"
  const path = typeof body.path === "string" ? body.path.slice(0, 256) : ""
  const entry: ShieldLogEntry = {
    ts: new Date().toISOString(),
    ip,
    type,
    path,
    data: body.data ?? null,
  }

  pushLog(entry)

  if (process.env.UPSTASH_REDIS_REST_URL?.trim()) {
    try {
      const { Redis } = await import("@upstash/redis")
      const redis = Redis.fromEnv()
      await redis.lpush("affisell:shield:logs", JSON.stringify(entry))
      await redis.ltrim("affisell:shield:logs", 0, MAX_LOGS - 1)
    } catch (err) {
      console.warn("[shield-client]", {
        step: "redis_log_failed",
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  console.log("[shield-client]", { step: "log_push", ip, type, path })
  return NextResponse.json({ ok: true })
}

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { auth } from "@/auth"
import {
  HumanoidShield,
  type ShieldEventLog,
} from "@/lib/security/humanoid-shield"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_LOGS = 500

async function isAdminSession(): Promise<boolean> {
  const session = await auth()
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN"
}

async function readRedisLogs(limit: number): Promise<ShieldEventLog[] | null> {
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
            return JSON.parse(item) as ShieldEventLog
          } catch {
            return null
          }
        }
        return item as ShieldEventLog
      })
      .filter((x): x is ShieldEventLog => Boolean(x))
  } catch {
    return null
  }
}

function pushLog(entry: ShieldEventLog): void {
  if (!globalThis.__shieldLogs) globalThis.__shieldLogs = []
  globalThis.__shieldLogs.unshift(entry)
  if (globalThis.__shieldLogs.length > MAX_LOGS) globalThis.__shieldLogs.length = MAX_LOGS
}

async function mergeBans(): Promise<Array<{ ip: string; blockedUntil: number }>> {
  await HumanoidShield.listRedisBans()
  const map = new Map<string, number>()
  for (const ban of HumanoidShield.getActiveBans()) {
    map.set(ban.ip, ban.blockedUntil)
  }
  return [...map.entries()]
    .map(([ip, blockedUntil]) => ({ ip, blockedUntil }))
    .sort((a, b) => b.blockedUntil - a.blockedUntil)
}

export async function GET(req: Request) {
  const callerIp = HumanoidShield.extractIp(req as NextRequest)
  const admin = await isAdminSession()
  if (!admin) {
    console.log("[shield-client]", { step: "logs_get_forbidden", ip: callerIp })
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), MAX_LOGS)

  const redisLogs = await readRedisLogs(limit)
  const logs = redisLogs ?? HumanoidShield.getMemoryLogs(limit)
  const bans = await mergeBans()

  return NextResponse.json({
    logs,
    bans,
    count: logs.length,
    source: redisLogs ? "redis" : "memory",
  })
}

export async function POST(req: Request) {
  const callerIp = HumanoidShield.extractIp(req as NextRequest)
  let body: {
    type?: unknown
    data?: unknown
    path?: unknown
    action?: unknown
    ip?: unknown
    minutes?: unknown
  } = {}

  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : ""

  if (action === "ban" || action === "unban") {
    const admin = await isAdminSession()
    const targetIp = typeof body.ip === "string" ? body.ip.trim() : callerIp

    if (action === "ban") {
      if (!admin) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 })
      }
      const minutes =
        typeof body.minutes === "number" && Number.isFinite(body.minutes)
          ? body.minutes
          : 10
      const ban = HumanoidShield.banIp(targetIp, minutes)
      pushLog({
        ts: new Date().toISOString(),
        ip: targetIp,
        type: "ADMIN_BAN",
        path: "/api/security/logs",
        data: { minutes, by: callerIp },
        action: "BLOCK",
      })
      console.log("[shield-client]", { step: "admin_ban", ip: targetIp, by: callerIp, minutes })
      return NextResponse.json({ ok: true, ban })
    }

    if (action === "unban") {
      const selfService = targetIp === callerIp
      if (!admin && !selfService) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 })
      }
      HumanoidShield.unbanIp(targetIp)
      pushLog({
        ts: new Date().toISOString(),
        ip: targetIp,
        type: selfService ? "SELF_UNBAN" : "ADMIN_UNBAN",
        path: "/api/security/logs",
        data: { by: callerIp },
      })
      console.log("[shield-client]", { step: "unban", ip: targetIp, by: callerIp, selfService })
      return NextResponse.json({ ok: true })
    }
  }

  const type = typeof body.type === "string" ? body.type.slice(0, 64) : "UNKNOWN"
  const path = typeof body.path === "string" ? body.path.slice(0, 256) : ""
  const entry: ShieldEventLog = {
    ts: new Date().toISOString(),
    ip: callerIp,
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

  console.log("[shield-client]", { step: "log_push", ip: callerIp, type, path })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const admin = await isAdminSession()
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const ip = url.searchParams.get("ip")?.trim()
  if (!ip) {
    return NextResponse.json({ error: "ip_required" }, { status: 400 })
  }

  HumanoidShield.unbanIp(ip)
  console.log("[shield-client]", {
    step: "delete_unban",
    ip,
    by: HumanoidShield.extractIp(req as NextRequest),
  })
  return NextResponse.json({ ok: true })
}

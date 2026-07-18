import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { RADAR_ENABLED } from "@/lib/radar/env"

export function isRadarEnabled(): boolean {
  return RADAR_ENABLED === "true"
}

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim())
}

/**
 * Fail-fast when Radar is on but Redis is missing (OAuth state must be shared across instances).
 * Safe to call from OAuth helpers; prefer `assertRadarRedisConfigured()` in HTTP handlers.
 */
export function requireRedis(): void {
  if (isRadarEnabled() && !isRedisConfigured()) {
    throw new Error("REDIS_URL required when RADAR_ENABLED=true")
  }
}

/** Guard for connect/OAuth start API handlers. */
export function assertRadarRedisConfigured(): NextResponse | null {
  if (!isRadarEnabled()) return null
  if (isRedisConfigured()) return null
  return NextResponse.json({ error: "Redis not configured" }, { status: 503 })
}

export function isRadarPath(pathname: string): boolean {
  return pathname.startsWith("/radar") || pathname.startsWith("/api/radar")
}

/** Cron routes stay reachable (auth via CRON_SECRET) even when feature flag is off. */
export function isRadarCronPath(pathname: string): boolean {
  return pathname.startsWith("/api/radar/cron")
}

export function radarDisabledResponse(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname
  if (!isRadarPath(pathname)) return null
  if (isRadarCronPath(pathname)) return null
  // Partner webhooks must stay reachable even if RADAR_ENABLED is off temporarily.
  if (pathname.startsWith("/api/radar/webhooks/")) return null
  if (isRadarEnabled()) return null
  return NextResponse.rewrite(new URL("/404", req.url))
}

/** Guard for /api/radar handlers. */
export function assertRadarApiEnabled(): NextResponse | null {
  if (isRadarEnabled()) return null
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

/** Alias used by API routes — same as assertRadarApiEnabled. */
export function gate(): NextResponse | null {
  return assertRadarApiEnabled()
}

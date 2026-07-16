import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { RADAR_ENABLED } from "@/lib/radar/env"

export function isRadarEnabled(): boolean {
  return RADAR_ENABLED === "true"
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

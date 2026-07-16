import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { RADAR_ENABLED } from "@/lib/radar/env"

export function isRadarEnabled(): boolean {
  return RADAR_ENABLED === "true"
}

export function isRadarPath(pathname: string): boolean {
  return pathname.startsWith("/radar") || pathname.startsWith("/api/radar")
}

export function radarDisabledResponse(req: NextRequest): NextResponse | null {
  if (!isRadarPath(req.nextUrl.pathname)) return null
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

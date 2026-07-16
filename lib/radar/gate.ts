import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { resolveRadarEnabled } from "@/lib/radar/env"

export function isRadarEnabled(): boolean {
  return resolveRadarEnabled() === "true"
}

export function isRadarPath(pathname: string): boolean {
  return pathname.startsWith("/radar") || pathname.startsWith("/api/radar")
}

export function radarDisabledResponse(req: NextRequest): NextResponse | null {
  if (!isRadarPath(req.nextUrl.pathname)) return null
  if (isRadarEnabled()) return null
  return NextResponse.rewrite(new URL("/404", req.url))
}

/** Guard for /api/radar handlers (matcher excludes /api/*). */
export function assertRadarApiEnabled(): NextResponse | null {
  if (isRadarEnabled()) return null
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

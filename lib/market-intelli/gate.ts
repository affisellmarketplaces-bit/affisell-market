import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export function isMarketIntelliEnabled(): boolean {
  return process.env.MARKET_INTELLI_ENABLED === "true"
}

export function isMarketIntelliPath(pathname: string): boolean {
  return pathname.startsWith("/intelli") || pathname.startsWith("/api/intelli")
}

export function marketIntelliDisabledResponse(req: NextRequest): NextResponse | null {
  if (!isMarketIntelliPath(req.nextUrl.pathname)) return null
  if (isMarketIntelliEnabled()) return null
  return NextResponse.rewrite(new URL("/404", req.url))
}

/** Guard for /api/intelli handlers (matcher excludes /api/*). */
export function assertMarketIntelliApiEnabled(): NextResponse | null {
  if (isMarketIntelliEnabled()) return null
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadResellerPerformance } from "@/lib/intelligence/reseller-performance.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/affiliate/performance — the signed-in reseller's OWN performance (lib/intelligence/reseller-performance.ts):
 * what earns them the most, what is becoming less profitable and why, what needs their attention today. Computed only
 * from that reseller's orders; there is no parameter to read another reseller's. Reseller session only. Read-only.
 */
export async function GET(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session?.user?.role !== "AFFILIATE") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), {
    prefix: "affiliate-performance",
    limit: 30,
    windowMs: 60_000,
  })
  if (limited) return limited

  return NextResponse.json(await loadResellerPerformance({ affiliateId: userId }))
}

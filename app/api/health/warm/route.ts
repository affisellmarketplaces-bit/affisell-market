import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Wakes the (Neon) database and the connection pool with two trivial queries.
 * Safe to call from a deploy hook, a smoke test or an uptime monitor after a deployment:
 *   curl -s https://affisell.com/api/health/warm
 */
export async function GET() {
  const started = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    const listings = await prisma.affiliateProduct.count({ where: { isListed: true } })
    return NextResponse.json({ ok: true, listings, ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } })
  } catch (error: unknown) {
    console.error("[health/warm]", error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { ok: false, ms: Date.now() - started },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}

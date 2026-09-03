import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { probeAliExpressDsConnection } from "@/lib/aliexpress-ds-probe.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/dropforge/ae-health?productId=
 * Public DS connectivity probe (rate-limited, no secrets).
 */
export async function GET(req: Request) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, null), {
    limit: 20,
    windowMs: 60 * 60 * 1000,
    prefix: "dropforge-ae-health",
  })
  if (limited) return limited

  const url = new URL(req.url)
  const productId = url.searchParams.get("productId")?.trim() ?? undefined
  const probe = await probeAliExpressDsConnection(productId)

  const status = !probe.configured ? 503 : probe.productGetOk ? 200 : 502
  return NextResponse.json(
    {
      status: probe.productGetOk ? "ok" : probe.configured ? "degraded" : "unconfigured",
      ...probe,
    },
    { status }
  )
}

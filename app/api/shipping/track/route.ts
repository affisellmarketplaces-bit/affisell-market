import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { lookupTracking } from "@/lib/shipping/track-anti-fake"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/shipping/track?code=&carrier=
 * Format + anti-fake heuristics + optional TrackingMore live status.
 */
export async function GET(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "shipping-track",
    limit: 40,
    windowMs: 60 * 1000,
  })
  if (limited) return limited

  const url = new URL(req.url)
  const code = url.searchParams.get("code")?.trim() ?? ""
  const carrier = url.searchParams.get("carrier")?.trim() ?? null

  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 })
  }

  try {
    const result = await lookupTracking({
      code,
      carrierHint: carrier,
      trackingMoreApiKey: process.env.TRACKINGMORE_API_KEY,
    })

    console.log("[shipping-track]", {
      result: "ok",
      tracking: result.tracking,
      carrier: result.detectedCarrier?.id ?? null,
      crackingScore: result.crackingScore,
      isFake: result.isFake,
      mode: result.mode,
    })

    return NextResponse.json({
      tracking: result.tracking,
      detectedCarrier: result.detectedCarrier
        ? {
            id: result.detectedCarrier.id,
            name: result.detectedCarrier.name,
            type: result.detectedCarrier.type,
            delivery_min: result.detectedCarrier.delivery_min,
            delivery_max: result.detectedCarrier.delivery_max,
            reliability: result.detectedCarrier.reliability,
            logo: result.detectedCarrier.logo,
            color: result.detectedCarrier.color,
            tracking_url: result.detectedCarrier.tracking_url,
            website: result.detectedCarrier.website,
          }
        : null,
      isValidFormat: result.isValidFormat,
      crackingScore: result.crackingScore,
      isFake: result.isFake,
      realStatus: result.realStatus,
      mode: result.mode,
      links: result.links,
    })
  } catch (err) {
    console.error("[shipping-track]", {
      result: "error",
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "track_failed" }, { status: 500 })
  }
}

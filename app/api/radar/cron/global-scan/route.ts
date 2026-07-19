import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runRadarGlobalScan } from "@/lib/radar/crawler/global-scan"
import { assertRadarScanRateLimit } from "@/lib/radar/scan-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Optional crawler keys — missing = degraded mode (Amazon scrape / local DB still run). */
const CRAWLER_OPTIONAL_KEYS = ["TIKTOK_CRAWLER_ACCESS_TOKEN", "SERPER_API_KEY"] as const

/**
 * Global Radar scan — best sellers per marketplace × category.
 * `Authorization: Bearer ${CRON_SECRET}` — schedule every 6h.
 *
 * Degraded mode: without TikTok/Serper keys, still crawls Amazon (+ other local sources).
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const limited = await assertRadarScanRateLimit(req)
  if (limited) return limited

  const missingOptional = CRAWLER_OPTIONAL_KEYS.filter((k) => !process.env[k]?.trim())
  if (missingOptional.length > 0) {
    console.warn("[radar/cron/global-scan]", {
      degraded: true,
      reason: "Missing optional crawler keys — continuing with Amazon/local",
      missing: missingOptional,
    })
  }

  try {
    const result = await runRadarGlobalScan()
    console.log("[radar/cron/global-scan]", {
      result: "ok",
      scanned: result.scanned,
      degraded: missingOptional.length > 0,
      missingOptional,
    })
    return NextResponse.json({
      ...result,
      degraded: missingOptional.length > 0,
      missingOptional: missingOptional.length > 0 ? [...missingOptional] : undefined,
    })
  } catch (err) {
    console.error("[radar/cron/global-scan]", {
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "Scan failed" }, { status: 500 })
  }
}

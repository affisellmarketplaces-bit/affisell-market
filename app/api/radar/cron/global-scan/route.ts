import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runRadarGlobalScan } from "@/lib/radar/crawler/global-scan"
import { assertRadarScanRateLimit } from "@/lib/radar/scan-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const CRAWLER_REQUIRED_KEYS = ["TIKTOK_CRAWLER_ACCESS_TOKEN", "SERPER_API_KEY"] as const

/**
 * Global Radar scan — best sellers per marketplace × category.
 * `Authorization: Bearer ${CRON_SECRET}` — schedule every 6h.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const limited = await assertRadarScanRateLimit(req)
  if (limited) return limited

  const missing = CRAWLER_REQUIRED_KEYS.filter((k) => !process.env[k]?.trim())
  if (missing.length > 0) {
    console.warn("[radar/cron/global-scan]", {
      skipped: true,
      reason: "Missing crawler keys",
      required: [...CRAWLER_REQUIRED_KEYS],
      missing,
    })
    return NextResponse.json(
      {
        skipped: true,
        reason: "Missing crawler keys",
        required: [...CRAWLER_REQUIRED_KEYS],
      },
      { status: 200 }
    )
  }

  try {
    const result = await runRadarGlobalScan()
    console.log("[radar/cron/global-scan]", { result: "ok", scanned: result.scanned })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[radar/cron/global-scan]", {
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "Scan failed" }, { status: 500 })
  }
}

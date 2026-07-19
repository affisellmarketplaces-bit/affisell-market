import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import {
  parseRadarCountries,
  runRadarGlobalScan,
} from "@/lib/radar/crawler/global-scan"
import { assertRadarScanRateLimit } from "@/lib/radar/scan-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Optional keys — missing = degraded (skip that source, continue others). */
const CRAWLER_OPTIONAL_KEYS = ["TIKTOK_CRAWLER_ACCESS_TOKEN", "SERPER_API_KEY"] as const

/**
 * Global Radar scan — parallel countries (FR/US/MX/…).
 * `Authorization: Bearer ${CRON_SECRET}`
 * Optional: `?countries=FR,US,MX`
 *
 * Per-country Redis/memory lock: `radar:global-scan:{country}:{day}`
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const limited = await assertRadarScanRateLimit(req)
  if (limited) return limited

  const url = new URL(req.url)
  const countries = parseRadarCountries(url.searchParams.get("countries"))

  const missingOptional = CRAWLER_OPTIONAL_KEYS.filter((k) => !process.env[k]?.trim())
  if (missingOptional.length > 0) {
    console.warn("[radar/cron/global-scan]", {
      degraded: true,
      missing: missingOptional,
      countries,
    })
  }

  console.log("[radar/cron/global-scan]", {
    result: "started",
    countries,
  })

  try {
    const result = await runRadarGlobalScan({ countries })
    console.log("[radar/cron/global-scan]", {
      result: "ok",
      scanned: result.scanned,
      countries: result.countries,
      jobs: result.jobs.length,
    })
    return NextResponse.json({
      started: true,
      countries: result.countries,
      jobs: result.jobs,
      ok: result.ok,
      scanned: result.scanned,
      new: result.new,
      updated: result.updated,
      errors: result.errors,
      skipped: result.skipped,
      reason: result.reason,
      degraded: missingOptional.length > 0 || result.degraded,
      missingOptional:
        missingOptional.length > 0 ? [...missingOptional] : result.missingOptional,
    })
  } catch (err) {
    console.error("[radar/cron/global-scan]", {
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "Scan failed", started: false }, { status: 500 })
  }
}

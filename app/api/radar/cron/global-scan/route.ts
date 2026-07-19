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
 * Auth: `Authorization: Bearer ${CRON_SECRET}` or `x-cron-secret`.
 * Optional: `?countries=FR,US,MX`
 *
 * Prefer: `npm run radar:crawl -- FR,US,MX` (see docs/RADAR_CRAWL.md)
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  let requestUrl: URL
  try {
    requestUrl = new URL(req.url)
  } catch {
    console.warn("[radar/cron/global-scan]", { result: "bad_request_url" })
    return NextResponse.json(
      {
        error: "BAD_REQUEST_URL",
        message:
          "Set URL env or use full https://… — prefer: npm run radar:crawl -- FR,US,MX",
      },
      { status: 400 }
    )
  }

  if (!requestUrl.host) {
    return NextResponse.json(
      {
        error: "BAD_REQUEST_URL",
        message:
          "Set URL env or use full https://… — prefer: npm run radar:crawl -- FR,US,MX",
      },
      { status: 400 }
    )
  }

  const limited = await assertRadarScanRateLimit(req)
  if (limited) return limited

  const countries = parseRadarCountries(requestUrl.searchParams.get("countries"))
  const publicBase =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    `${requestUrl.protocol}//${requestUrl.host}`

  const missingOptional = CRAWLER_OPTIONAL_KEYS.filter((k) => !process.env[k]?.trim())
  if (missingOptional.length > 0) {
    console.warn("[radar/cron/global-scan]", {
      degraded: true,
      missing: missingOptional,
      countries,
    })
  }

  console.log("[global-scan]", {
    result: "triggered",
    countries: countries.join(","),
    host: requestUrl.host,
  })
  console.log(`[global-scan] triggered for countries=${countries.join(",")}`)

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
      url: publicBase.replace(/\/$/, ""),
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
      message: "Crawl launched, check /admin/radar in 30s",
    })
  } catch (err) {
    console.error("[radar/cron/global-scan]", {
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "Scan failed", started: false }, { status: 500 })
  }
}

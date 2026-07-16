import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runRadarGlobalScan } from "@/lib/radar/crawler/global-scan"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Global Radar scan — best sellers per marketplace × category.
 * `Authorization: Bearer ${CRON_SECRET}` — schedule every 6h.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runRadarGlobalScan()
  return NextResponse.json(result)
}

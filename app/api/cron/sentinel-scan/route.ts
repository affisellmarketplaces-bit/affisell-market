import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runSentinelScan } from "@/lib/sentinel/run-scan"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Sentinel scan — aggregate ops signals. `Authorization: Bearer ${CRON_SECRET}` */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runSentinelScan({ alertNewP0: true })
  return NextResponse.json(result)
}

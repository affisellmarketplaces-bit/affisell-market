import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runBrandPulseWeeklyDigestCron } from "@/lib/cron/brand-pulse-weekly-digest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runBrandPulseWeeklyDigestCron(50)
  return NextResponse.json({ ok: true, ...result })
}

import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runBrandPulseStagnationAbCron } from "@/lib/cron/brand-pulse-stagnation-ab"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runBrandPulseStagnationAbCron(60)
  return NextResponse.json({ ok: true, ...result })
}

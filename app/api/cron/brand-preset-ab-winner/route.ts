import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runBrandPresetAbWinnerCron } from "@/lib/cron/brand-preset-ab-winner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runBrandPresetAbWinnerCron(30)
  return NextResponse.json({ ok: true, ...result })
}

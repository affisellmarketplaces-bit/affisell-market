import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runAliExpressRefreshJob } from "@/lib/aliexpress-refresh-job.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Cron — Authorization: Bearer ${CRON_SECRET} */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const { status, body } = await runAliExpressRefreshJob("[cron/aliexpress-refresh]")
  return NextResponse.json(body, { status })
}

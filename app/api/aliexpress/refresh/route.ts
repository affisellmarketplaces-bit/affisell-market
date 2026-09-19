import { NextResponse } from "next/server"

import { authorizeAliExpressOps } from "@/lib/aliexpress-ops-auth"
import { runAliExpressRefreshJob } from "@/lib/aliexpress-refresh-job.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Force AliExpress token refresh + DB persist (scheduled every 6h).
 * Auth: Bearer / x-cron-secret / ?secret= / HMAC (same as order create). */
export async function GET(req: Request) {
  const denied = authorizeAliExpressOps(req)
  if (denied) return denied

  const { status, body } = await runAliExpressRefreshJob("[aliexpress-refresh]")
  return NextResponse.json(body, { status })
}

import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runCustomDomainNudgeCron } from "@/lib/cron/custom-domain-nudge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Daily cron: nudge merchants with inactive custom domain (once per store).
 * Bearer ${CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runCustomDomainNudgeCron(40)
  return NextResponse.json({ ok: true, ...result })
}

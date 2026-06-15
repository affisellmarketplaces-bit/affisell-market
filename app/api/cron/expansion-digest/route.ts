import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runExpansionDigestCron } from "@/lib/cron/expansion-digest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Weekly expansion digest — `Authorization: Bearer ${CRON_SECRET}` */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runExpansionDigestCron()
  return NextResponse.json({ ok: true, ...result })
}

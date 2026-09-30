import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { endExpiredBattles } from "@/lib/pulse/battle-engine"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** End PulseBattles whose timer expired, even if nobody is on the arena page. Bearer ${CRON_SECRET} */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await endExpiredBattles()
  console.log("[cron.end-expired-battles]", result)
  return NextResponse.json({ ok: true, ...result })
}

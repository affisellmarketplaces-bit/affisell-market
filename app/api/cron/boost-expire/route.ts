import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { expireLegionBoosts } from "@/lib/legion/expire-boosts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/cron/boost-expire
 * Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const expired = await expireLegionBoosts()
  console.log("[cron/boost-expire]", { result: "ok", expired })
  return NextResponse.json({ ok: true, expired })
}

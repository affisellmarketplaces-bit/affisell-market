import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runIntelligenceDaily } from "@/lib/strategic-intelligence/scheduled.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * Daily AFFISELL INTELLIGENCE run (lib/strategic-intelligence/scheduled*.ts): computes the founder cockpit, logs the
 * signals it raised, measures the decisions that came due (each once, by its unique key) and sends ONE digest to the
 * ops channel when something is new. Writes only the signal log / outcomes / decision status — never a price, never
 * money, never a product. Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied
  const result = await runIntelligenceDaily()
  return NextResponse.json({ ok: result.measureFailed === 0, ...result }, { status: result.measureFailed === 0 ? 200 : 500 })
}

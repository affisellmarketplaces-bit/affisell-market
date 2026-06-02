import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runProcessTransfersJob } from "@/lib/transfers/process-transfers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Vercel Cron (every 2 min) + internal enqueue after checkout webhook.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runProcessTransfersJob({ metric: "transfer_job_run" })
  return NextResponse.json({ ok: true, ...result })
}

import { type NextRequest, NextResponse } from "next/server"

import { runProcessTransfersJob } from "@/lib/transfers/process-transfers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Vercel Cron (every 2 min) + internal enqueue after checkout webhook.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get("authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await runProcessTransfersJob({ metric: "transfer_job_run" })
  return NextResponse.json({ ok: true, ...result })
}

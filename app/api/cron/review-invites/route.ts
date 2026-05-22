import { type NextRequest, NextResponse } from "next/server"

import { runReviewReminderCron } from "@/lib/cron/review-reminder"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** @deprecated Use `/api/cron/review-reminder` (J+7). Kept for backward-compatible cron URLs. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get("authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await runReviewReminderCron({ daysAfterDelivery: 7, limit: 50 })
  return NextResponse.json({ ok: true, legacy: true, ...result })
}

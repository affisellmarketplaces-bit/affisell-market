import { type NextRequest, NextResponse } from "next/server"

import { runLegalGuardianScan } from "@/lib/legal/run-legal-scan"
import { sendLegalSlackAlert } from "@/lib/slack/send-legal-alert"
import { secureBearerMatch } from "@/lib/secure-bearer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true

  const secret = process.env.CRON_SECRET?.trim()
  if (secret && secureBearerMatch(req.headers.get("authorization"), secret)) {
    return true
  }

  if (process.env.NODE_ENV !== "production") return true
  return false
}

/**
 * Daily 08:00 UTC — Legal Guardian scan (products + suppliers) + Slack #juridique if risk > 70.
 * Dry-run: `GET /api/cron/legal-guardian?dry=1`
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get("dry") === "1"
  console.log("[cron:legal-guardian]", { result: "request", dryRun })

  const { stats, highRisk } = await runLegalGuardianScan({ dryRun })

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      stats,
      highRisk,
    })
  }

  const slack = await sendLegalSlackAlert({ rows: highRisk, dryRun: false })

  return NextResponse.json({
    ok: true,
    ...stats,
    slackSent: slack.sent,
    highRisk,
  })
}

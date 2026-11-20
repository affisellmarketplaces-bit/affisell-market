import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runLegalGuardianScan } from "@/lib/legal/run-legal-scan"
import { sendLegalSlackAlert } from "@/lib/slack/send-legal-alert"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * Daily 08:00 UTC — Legal Guardian scan (products + suppliers) + Slack #juridique if risk > 70.
 * Dry-run: `GET /api/cron/legal-guardian?dry=1`
 */
export async function GET(req: NextRequest) {
  // Same gate as every other cron: Bearer / x-cron-secret, CRON_SECRET mandatory in production. The `x-vercel-cron` header
  // used to be trusted on its own, but any caller can set it (finalisation master doc, C3). Vercel Cron itself sends
  // `Authorization: Bearer $CRON_SECRET` when the variable is set on the project.
  const denied = authorizeCronRequest(req)
  if (denied) return denied

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

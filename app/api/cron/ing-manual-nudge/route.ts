import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runIngManualNudgeCron } from "@/lib/cron/ing-manual-nudge"
import { checkEscalation } from "@/lib/ing/escalation"
import { loadManualSupplierNudgeCandidates } from "@/lib/ing/manual-supplier-nudge"
import { fulfillmentPrisma } from "@/lib/prisma"
import { sendIngSlackAlert } from "@/lib/slack/send-ing-alert"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Daily 09:00 UTC — nudge suppliers with manual_required fulfillment groups (7d, max 1 / 48h).
 * Dry-run: `GET /api/cron/ing-manual-nudge?dry=1`
 */
export async function GET(req: NextRequest) {
  // Same gate as every other cron: Bearer / x-cron-secret, CRON_SECRET mandatory in production. The `x-vercel-cron` header
  // used to be trusted on its own, but any caller can set it (finalisation master doc, C3). Vercel Cron itself sends
  // `Authorization: Bearer $CRON_SECRET` when the variable is set on the project.
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const dryRun = req.nextUrl.searchParams.get("dry") === "1"
  console.log("[cron:ing-manual-nudge]", { result: "request", dryRun })

  const [allEligible, cooledEligible, escalationCandidates] = await Promise.all([
    loadManualSupplierNudgeCandidates(fulfillmentPrisma, { enforceCooldown: false }),
    loadManualSupplierNudgeCandidates(fulfillmentPrisma, { enforceCooldown: true }),
    checkEscalation(fulfillmentPrisma),
  ])
  const skipped48h = Math.max(0, allEligible.candidates.length - cooledEligible.candidates.length)
  const topSupplier = cooledEligible.candidates[0]

  const result = await runIngManualNudgeCron({ dryRun })

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      suppliers: result.suppliers,
      groupsCount: result.groupsCount,
      skipped48h,
      escalationCandidates,
    })
  }

  const recentLogs = await fulfillmentPrisma.ingNudgeLog.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { resendId: true },
  })
  const resendIds = recentLogs
    .map((l) => l.resendId?.trim())
    .filter((id): id is string => Boolean(id))

  await sendIngSlackAlert({
    groupsCount: result.groupsCount,
    sent: result.sent,
    skipped48h,
    resendIds,
    topSupplier: topSupplier
      ? {
          email: topSupplier.email,
          name: topSupplier.name,
          manualGroups: topSupplier.manualGroups,
        }
      : undefined,
    escalationCandidates,
    dryRun: false,
  })

  return NextResponse.json({
    ok: true,
    ...result,
    skipped48h,
    escalationCandidates,
  })
}

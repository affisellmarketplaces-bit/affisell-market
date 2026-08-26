import { type NextRequest, NextResponse } from "next/server"

import { runIngManualNudgeCron } from "@/lib/cron/ing-manual-nudge"
import { checkEscalation } from "@/lib/ing/escalation"
import { loadManualSupplierNudgeCandidates } from "@/lib/ing/manual-supplier-nudge"
import { fulfillmentPrisma } from "@/lib/prisma"
import { sendIngSlackAlert } from "@/lib/slack/send-ing-alert"
import { secureBearerMatch } from "@/lib/secure-bearer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

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
 * Daily 09:00 UTC — nudge suppliers with manual_required fulfillment groups (7d, max 1 / 48h).
 * Dry-run: `GET /api/cron/ing-manual-nudge?dry=1`
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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

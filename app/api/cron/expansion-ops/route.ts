import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runCheckoutLaunchFollowupCron } from "@/lib/cron/checkout-launch-followup"
import { runCheckoutLaunchNotifyCron } from "@/lib/cron/checkout-launch-notify"
import { runExpansionAutoPauseNotifyCron } from "@/lib/cron/expansion-auto-pause-notify"
import { runExpansionAutoResumeNotifyCron } from "@/lib/cron/expansion-auto-resume-notify"
import { runExpansionDeliveryRateAlert } from "@/lib/cron/expansion-delivery-rate-alert"
import { runExpansionGraduatedComplaintAlert } from "@/lib/cron/expansion-graduated-complaint-alert"
import { runExpansionComplaintAlert } from "@/lib/cron/expansion-complaint-alert"
import { runExpansionBounceRateAlert } from "@/lib/cron/expansion-bounce-rate-alert"
import { runSuppressedWaitlistPurgeCron } from "@/lib/cron/expansion-suppressed-waitlist-purge"
import { runExpansionAutoPilotAfterFirstOrders } from "@/lib/cron/expansion-auto-pilot"
import { runExpansionDigestCron } from "@/lib/cron/expansion-digest"
import { runGraduationEmailRetryCron } from "@/lib/cron/expansion-graduation-email-retry"
import { runGraduationEmailStallAlert } from "@/lib/cron/expansion-graduation-email-stall"
import { runExpansionRolloutMetricsCron } from "@/lib/cron/expansion-rollout-metrics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Vercel Cron: expansion ops — notify batches, J+2 follow-up, first-order metrics, weekly digest.
 * `Authorization: Bearer ${CRON_SECRET}`
 */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const digestOnly = req.nextUrl.searchParams.get("digest") === "1"

  if (digestOnly) {
    const digest = await runExpansionDigestCron()
    return NextResponse.json({ ok: true, digest })
  }

  const [notify, followup, metrics] = await Promise.all([
    runCheckoutLaunchNotifyCron(),
    runCheckoutLaunchFollowupCron(),
    runExpansionRolloutMetricsCron(),
  ])

  const autoPilot = await runExpansionAutoPilotAfterFirstOrders(metrics.newFirstOrderCountries)
  const bounceRateAlert = await runExpansionBounceRateAlert()
  const deliveryRateAlert = await runExpansionDeliveryRateAlert()
  const complaintAlert = await runExpansionComplaintAlert()
  const graduatedComplaintAlert = await runExpansionGraduatedComplaintAlert()
  const autoPauseNotify = await runExpansionAutoPauseNotifyCron()
  const autoResumeNotify = await runExpansionAutoResumeNotifyCron()
  const suppressedPurge = await runSuppressedWaitlistPurgeCron()
  const graduationEmailStall = await runGraduationEmailStallAlert()
  const graduationEmailRetry = await runGraduationEmailRetryCron()

  return NextResponse.json({
    ok: true,
    notify,
    followup,
    metrics,
    autoPilot,
    bounceRateAlert,
    deliveryRateAlert,
    complaintAlert,
    graduatedComplaintAlert,
    autoPauseNotify,
    autoResumeNotify,
    suppressedPurge,
    graduationEmailStall,
    graduationEmailRetry,
  })
}

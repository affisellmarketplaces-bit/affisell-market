import { type NextRequest, NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runCheckoutLaunchFollowupCron } from "@/lib/cron/checkout-launch-followup"
import { runCheckoutLaunchNotifyCron } from "@/lib/cron/checkout-launch-notify"
import { runExpansionAutoPauseFollowupCron } from "@/lib/cron/expansion-auto-pause-followup"
import { runExpansionAutoPauseNotifyCron } from "@/lib/cron/expansion-auto-pause-notify"
import { runExpansionAutoResumeFollowupCron } from "@/lib/cron/expansion-auto-resume-followup"
import { runExpansionAutoResumeNotifyCron } from "@/lib/cron/expansion-auto-resume-notify"
import { runExpansionDeliveryRateAlert } from "@/lib/cron/expansion-delivery-rate-alert"
import { runExpansionFollowupDeliveryRateAlert } from "@/lib/cron/expansion-followup-delivery-rate-alert"
import { runExpansionFollowupBounceRateAlert } from "@/lib/cron/expansion-followup-bounce-rate-alert"
import { runExpansionGraduatedComplaintAlert } from "@/lib/cron/expansion-graduated-complaint-alert"
import { runExpansionAutoPauseGraduationCron } from "@/lib/cron/expansion-auto-pause-graduation"
import { runExpansionAutoResumeGraduationCron } from "@/lib/cron/expansion-auto-resume-graduation"
import { runExpansionGraduatedBounceRateAlert } from "@/lib/cron/expansion-graduated-bounce-rate-alert"
import { runExpansionGraduatedDeliveryRateAlert } from "@/lib/cron/expansion-graduated-delivery-rate-alert"
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
  const followupDeliveryRateAlert = await runExpansionFollowupDeliveryRateAlert()
  const followupBounceRateAlert = await runExpansionFollowupBounceRateAlert()
  const complaintAlert = await runExpansionComplaintAlert()
  const graduatedComplaintAlert = await runExpansionGraduatedComplaintAlert()
  const graduatedDeliveryRateAlert = await runExpansionGraduatedDeliveryRateAlert()
  const graduatedBounceRateAlert = await runExpansionGraduatedBounceRateAlert()
  const autoPauseGraduation = await runExpansionAutoPauseGraduationCron()
  const autoResumeGraduation = await runExpansionAutoResumeGraduationCron()
  const autoPauseNotify = await runExpansionAutoPauseNotifyCron()
  const autoPauseFollowup = await runExpansionAutoPauseFollowupCron()
  const autoResumeNotify = await runExpansionAutoResumeNotifyCron()
  const autoResumeFollowup = await runExpansionAutoResumeFollowupCron()
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
    followupDeliveryRateAlert,
    followupBounceRateAlert,
    complaintAlert,
    graduatedComplaintAlert,
    graduatedDeliveryRateAlert,
    graduatedBounceRateAlert,
    autoPauseGraduation,
    autoResumeGraduation,
    autoPauseNotify,
    autoPauseFollowup,
    autoResumeNotify,
    autoResumeFollowup,
    suppressedPurge,
    graduationEmailStall,
    graduationEmailRetry,
  })
}

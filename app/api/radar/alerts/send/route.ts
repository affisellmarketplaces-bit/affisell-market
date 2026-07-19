import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import {
  authorizeRadarAlertsApi,
  isSlackWebhookConfigured,
} from "@/lib/radar/alerts/auth"
import { sendRadarAlertEmail } from "@/lib/radar/alerts/email"
import { resolveGlobalSlackWebhook, sendSlackWebhookText } from "@/lib/radar/alerts/slack"
import { gate } from "@/lib/radar/gate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/radar/alerts/send
 * Machine auth: x-api-key (RADAR_ALERTS_API_KEY) or x-cron-secret / Bearer CRON_SECRET.
 * Admin session (role ADMIN) also allowed for QA from /admin/radar.
 *
 * Body optional: { type?, title?, message?, emailTo?, channel?: "slack"|"email"|"both" }
 */
export async function POST(req: Request) {
  const blocked = gate()
  if (blocked) return blocked

  const apiDenied = authorizeRadarAlertsApi(req)
  let authorized = !apiDenied

  if (apiDenied) {
    const session = await auth()
    const role = (session?.user as { role?: string } | undefined)?.role
    if (session?.user?.id && role === "ADMIN") {
      authorized = true
    } else {
      return apiDenied
    }
  }

  if (!authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Missing x-api-key" },
      { status: 401 }
    )
  }

  const body = (await req.json().catch(() => ({}))) as {
    type?: string
    title?: string
    message?: string
    emailTo?: string
    channel?: "slack" | "email" | "both"
  }

  const channel = body.channel ?? "slack"
  const type = (body.type ?? "WINNER_NEW").trim() || "WINNER_NEW"
  const title = (body.title ?? "Radar test alert").trim()
  const message =
    (body.message ?? "🔥 WINNER DETECTED test — Affisell Radar alert channel OK.").trim()

  const result: {
    ok: boolean
    slack?: { sent: boolean; error?: string }
    email?: { emailed: boolean; reason?: string; resendId?: string }
  } = { ok: true }

  if (channel === "slack" || channel === "both") {
    const webhook = resolveGlobalSlackWebhook()
    if (!webhook) {
      console.warn("[radar/alerts/send]", { result: "slack_not_configured" })
      return NextResponse.json(
        { error: "SLACK_NOT_CONFIGURED", message: "SLACK_WEBHOOK_URL missing" },
        { status: 503 }
      )
    }
    const slack = await sendSlackWebhookText(
      webhook,
      `*HIGH* - ${title}\n${message}\nVoir produit | affisell radar · ${type}`
    )
    if (!slack.ok) {
      result.ok = false
      result.slack = { sent: false, error: `Slack HTTP ${slack.status}` }
      console.error("[radar/alerts/send]", { result: "slack_failed", status: slack.status })
      return NextResponse.json(
        { error: "SLACK_SEND_FAILED", ...result },
        { status: 502 }
      )
    }
    result.slack = { sent: true }
  }

  if (channel === "email" || channel === "both") {
    const session = await auth()
    const to =
      body.emailTo?.trim() ||
      session?.user?.email?.trim() ||
      process.env.TEST_EMAIL_TO?.trim() ||
      ""
    const emailResult = await sendRadarAlertEmail({
      to,
      type,
      title,
      message,
      severity: "high",
      marketplaceId: "admin",
      country: "US",
    })
    result.email = {
      emailed: emailResult.emailed,
      reason: emailResult.emailed ? undefined : emailResult.reason,
      resendId: emailResult.emailed ? emailResult.resendId : undefined,
    }
  }

  console.log("[radar/alerts/send]", {
    result: "ok",
    channel,
    slack: result.slack?.sent,
    emailed: result.email?.emailed,
    slackConfigured: isSlackWebhookConfigured(),
  })

  return NextResponse.json(result)
}

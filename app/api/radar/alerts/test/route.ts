import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { decryptString } from "@/lib/crypto"
import { hasRadarAccess, resolveRadarFeatures } from "@/lib/radar/features"
import { gate } from "@/lib/radar/gate"
import { getRadarDb } from "@/lib/prisma-radar"
import { sendSlackWebhookText } from "@/lib/radar/alerts/slack"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST /api/radar/alerts/test — send a test Slack message to the user's webhook. */
export async function POST() {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Missing x-api-key" },
      { status: 401 }
    )
  }

  const features =
    Array.isArray(session.user.features) && session.user.features.length > 0
      ? session.user.features
      : resolveRadarFeatures(session.user.id, session.user.isPro ?? false)
  if (!hasRadarAccess(features, session.user.id, session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const sub = await getRadarDb().alertSubscription.findUnique({
      where: {
        userId_channel: { userId: session.user.id, channel: "slack" },
      },
    })

    let webhook = ""
    if (sub?.webhookUrl != null) {
      try {
        webhook = decryptString(sub.webhookUrl)
      } catch (err) {
        console.error("[radar/alerts/test]", {
          userId: session.user.id,
          result: "decrypt_failed",
          message: err instanceof Error ? err.message : "unknown",
        })
        return NextResponse.json(
          { error: "SLACK_NOT_CONFIGURED", message: "Stored webhook decrypt failed" },
          { status: 503 }
        )
      }
    } else {
      webhook = process.env.SLACK_WEBHOOK_URL?.trim() || ""
    }

    if (!webhook) {
      return NextResponse.json(
        { error: "SLACK_NOT_CONFIGURED", message: "SLACK_WEBHOOK_URL missing" },
        { status: 503 }
      )
    }

    const text =
      "*HIGH* - Radar test alert\n🔥 WINNER DETECTED test — Affisell Radar est branché.\nVoir produit | affisell radar"

    const slack = await sendSlackWebhookText(webhook, text)
    if (!slack.ok) {
      return NextResponse.json({ error: `Slack HTTP ${slack.status}` }, { status: 502 })
    }

    console.log("[radar/alerts/test]", { userId: session.user.id, result: "sent" })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[radar/alerts/test]", {
      userId: session.user.id,
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "Test failed" }, { status: 500 })
  }
}

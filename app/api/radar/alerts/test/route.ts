import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { decryptString } from "@/lib/crypto"
import { hasRadarAccess, resolveRadarFeatures } from "@/lib/radar/features"
import { gate } from "@/lib/radar/gate"
import { getRadarDb } from "@/lib/prisma-radar"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST /api/radar/alerts/test — send a test Slack message to the user's webhook. */
export async function POST() {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const features =
    Array.isArray(session.user.features) && session.user.features.length > 0
      ? session.user.features
      : resolveRadarFeatures(session.user.id, session.user.isPro ?? false)
  if (!hasRadarAccess(features, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const sub = await getRadarDb().alertSubscription.findUnique({
      where: {
        userId_channel: { userId: session.user.id, channel: "slack" },
      },
    })

    let webhook =
      sub?.webhookUrl != null
        ? decryptString(sub.webhookUrl)
        : process.env.SLACK_WEBHOOK_URL?.trim() || ""

    if (!webhook) {
      return NextResponse.json({ error: "No Slack webhook configured" }, { status: 400 })
    }

    const text =
      "*HIGH* - Radar test alert\n🔥 WINNER DETECTED test — Affisell Radar est branché.\nVoir produit | affisell radar"

    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Slack HTTP ${res.status}` }, { status: 502 })
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

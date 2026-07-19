import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export function getRadarAlertsApiKey(): string | null {
  return process.env.RADAR_ALERTS_API_KEY?.trim() || null
}

export function isRadarAlertsApiKeyConfigured(): boolean {
  return Boolean(getRadarAlertsApiKey())
}

export function isSlackWebhookConfigured(): boolean {
  return Boolean(process.env.SLACK_WEBHOOK_URL?.trim())
}

export function isResendConfiguredForRadar(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

/**
 * Authorize machine-to-machine Radar alert sends.
 * Accepts: `x-api-key: RADAR_ALERTS_API_KEY` OR `x-cron-secret` / Bearer CRON_SECRET.
 */
export function authorizeRadarAlertsApi(req: Request): NextResponse | null {
  const apiKey = getRadarAlertsApiKey()
  const cronSecret = process.env.CRON_SECRET?.trim() || null

  const headerKey = req.headers.get("x-api-key")?.trim() || ""
  const cronHeader =
    req.headers.get("x-cron-secret")?.trim() ||
    (() => {
      const auth = req.headers.get("authorization")?.trim() || ""
      const m = /^Bearer\s+(.+)$/i.exec(auth)
      return m?.[1]?.trim() || ""
    })()

  if (apiKey && headerKey && safeEqual(headerKey, apiKey)) {
    return null
  }

  if (cronSecret && cronHeader && safeEqual(cronHeader, cronSecret)) {
    return null
  }

  console.warn("[radar/alerts/auth]", { result: "unauthorized" })
  return NextResponse.json(
    { error: "UNAUTHORIZED", message: "Missing x-api-key" },
    { status: 401 }
  )
}

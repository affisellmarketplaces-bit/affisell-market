import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { createAeCaptureSession } from "@/lib/fulfillment/ae-capture-session"
import { createAeCaptureToken } from "@/lib/fulfillment/ae-capture-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function newRelayKey(): string {
  return `df_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Public DropForge browser bridge session (rate-limited, no auth). */
export async function POST(req: Request) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, null), {
    limit: 40,
    windowMs: 60 * 60 * 1000,
    prefix: "dropforge-ae-session",
  })
  if (limited) return limited

  const relayKey = newRelayKey()
  const sessionId = await createAeCaptureSession(relayKey)
  const captureToken = createAeCaptureToken(sessionId, relayKey)

  console.log("[dropforge-ae-capture]", { relayKey, sessionId, result: "session_created" })

  return NextResponse.json({
    ok: true,
    relayKey,
    sessionId,
    captureToken,
    expiresInSec: 900,
  })
}

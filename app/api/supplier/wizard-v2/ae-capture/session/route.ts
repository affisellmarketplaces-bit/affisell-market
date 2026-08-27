import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { createAeCaptureSession } from "@/lib/fulfillment/ae-capture-session"
import { createAeCaptureToken } from "@/lib/fulfillment/ae-capture-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function newRelayKey(userId: string): string {
  const tail = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "sup"
  return `wzv2_${tail}_${Date.now().toString(36)}`
}

/** Start browser relay session for wizard Express AliExpress import. */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  const role = (session.user as { role?: string }).role
  if (role !== "SUPPLIER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const relayKey = newRelayKey(session.user.id)
  const sessionId = await createAeCaptureSession(relayKey)
  const captureToken = createAeCaptureToken(sessionId, relayKey)

  console.log("[wizard-v2-ae-capture]", {
    userId: session.user.id,
    relayKey,
    sessionId,
    result: "session_created",
  })

  return NextResponse.json({
    ok: true,
    relayKey,
    sessionId,
    captureToken,
    expiresInSec: 900,
  })
}

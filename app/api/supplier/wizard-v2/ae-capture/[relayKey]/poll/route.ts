import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import {
  consumeAeCaptureSession,
  peekAeCaptureSession,
} from "@/lib/fulfillment/ae-capture-session"
import { verifyAeCaptureToken } from "@/lib/fulfillment/ae-capture-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  ctx: { params: Promise<{ relayKey: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  const role = (session.user as { role?: string }).role
  if (role !== "SUPPLIER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { relayKey } = await ctx.params
  const url = new URL(req.url)
  const sessionId = url.searchParams.get("sessionId")?.trim()
  if (!sessionId) {
    return NextResponse.json({ error: "session_required" }, { status: 400 })
  }

  const consume = url.searchParams.get("consume") === "1"
  const result = consume
    ? await consumeAeCaptureSession(sessionId, relayKey)
    : await peekAeCaptureSession(sessionId, relayKey)

  if (!result) {
    return NextResponse.json({ ok: true, ready: false })
  }

  return NextResponse.json({ ok: true, ready: true, ...(result as object) })
}

const pollTokenSchema = z.object({
  sessionId: z.string().min(4),
  captureToken: z.string().min(8),
})

/** Token-only poll from relay popup (no cookies on cross-origin). */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ relayKey: string }> }
) {
  const { relayKey } = await ctx.params
  const body = pollTokenSchema.parse(await req.json())
  if (!verifyAeCaptureToken(body.captureToken, body.sessionId, relayKey)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const consume = url.searchParams.get("consume") === "1"
  const result = consume
    ? await consumeAeCaptureSession(body.sessionId, relayKey)
    : await peekAeCaptureSession(body.sessionId, relayKey)

  if (!result) {
    return NextResponse.json({ ok: true, ready: false })
  }

  return NextResponse.json({ ok: true, ready: true, ...(result as object) })
}

import { NextResponse } from "next/server"
import { z } from "zod"

import {
  consumeAeCaptureSession,
  peekAeCaptureSession,
} from "@/lib/fulfillment/ae-capture-session"
import { verifyAeCaptureToken } from "@/lib/fulfillment/ae-capture-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const pollTokenSchema = z.object({
  sessionId: z.string().min(4),
  captureToken: z.string().min(8),
})

/** Token-only poll from DropForge relay popup (public, no cookies). */
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

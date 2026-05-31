import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { consumeAeCaptureSession } from "@/lib/fulfillment/ae-capture-session"

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id: productId } = await ctx.params
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim()
  if (!sessionId) {
    return NextResponse.json({ error: "session_required" }, { status: 400 })
  }

  const result = await consumeAeCaptureSession(sessionId, productId)
  if (!result) {
    return NextResponse.json({ ok: true, ready: false })
  }

  return NextResponse.json({ ok: true, ready: true, ...(result as object) })
}

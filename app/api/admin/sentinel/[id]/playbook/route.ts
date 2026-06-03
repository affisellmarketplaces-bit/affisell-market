import { NextResponse } from "next/server"

import { retryAdminAutoBuyFulfillmentLog } from "@/lib/admin/auto-fulfill/retry-auto-buy"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/** Execute a Sentinel playbook action (1-click ops). */
export async function POST(_req: Request, { params }: Params) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const signal = await prisma.opsSignal.findUnique({
    where: { id },
    select: { id: true, playbook: true, entityType: true, entityId: true, code: true },
  })

  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 })
  }

  if (signal.playbook === "retry-auto-buy" && signal.entityType === "fulfillmentLog" && signal.entityId) {
    const result = await retryAdminAutoBuyFulfillmentLog(signal.entityId)
    if (!result.ok) {
      console.log("[sentinel]", {
        signalId: id,
        playbook: signal.playbook,
        result: result.error,
        actorId: auth.session.user.id,
      })
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    console.log("[sentinel]", {
      signalId: id,
      playbook: signal.playbook,
      fulfillmentLogId: result.fulfillmentLogId,
      queue: result.queue,
      result: "playbook_ok",
      actorId: auth.session.user.id,
    })

    return NextResponse.json({
      ok: true,
      action: "retry-auto-buy",
      fulfillmentLogId: result.fulfillmentLogId,
      queue: result.queue,
    })
  }

  return NextResponse.json({ error: "unsupported_playbook" }, { status: 400 })
}

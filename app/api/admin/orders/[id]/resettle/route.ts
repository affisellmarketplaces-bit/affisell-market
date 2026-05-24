import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { resetOrderTransferAttempts } from "@/lib/transfers/reset-order-transfers"
import { runProcessTransfersJob } from "@/lib/transfers/process-transfers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { id: orderId } = await ctx.params
  await resetOrderTransferAttempts(orderId)
  const result = await runProcessTransfersJob({ metric: "resettle_run", orderId })

  return NextResponse.json({ ok: true, orderId, ...result })
}

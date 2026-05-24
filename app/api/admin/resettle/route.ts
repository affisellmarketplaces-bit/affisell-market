import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { resetOrderTransferAttempts } from "@/lib/transfers/reset-order-transfers"
import { runProcessTransfersJob } from "@/lib/transfers/process-transfers"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  orderId: z.string().min(1),
})

export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 })
  }

  const { orderId } = parsed.data

  const attempts = await prisma.transferAttempt.findMany({
    where: { orderId },
    select: { status: true },
  })
  if (attempts.length === 0) {
    return NextResponse.json({ error: "no_transfer_attempts" }, { status: 404 })
  }

  const allSuccess = attempts.every((a) => a.status === "SUCCESS")
  if (allSuccess) {
    return NextResponse.json({ error: "already_settled" }, { status: 400 })
  }

  await resetOrderTransferAttempts(orderId)
  const result = await runProcessTransfersJob({ metric: "resettle_run", orderId })

  return NextResponse.json({ ok: true, orderId, ...result })
}

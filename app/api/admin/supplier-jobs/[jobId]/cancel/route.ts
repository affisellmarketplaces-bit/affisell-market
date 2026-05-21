import { type NextRequest, NextResponse } from "next/server"

import { cancelSupplierFulfillmentJob } from "@/lib/admin/orders/cancel-supplier-job"
import { loadAdminOrderDetail } from "@/lib/admin/orders/load-order"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ jobId: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { jobId } = await ctx.params
  const line = await prisma.supplierFulfillmentOrderLine.findFirst({
    where: { supplierFulfillmentOrderId: jobId },
    select: { orderId: true },
  })
  if (!line) return NextResponse.json({ error: "job_not_found" }, { status: 404 })

  const result = await cancelSupplierFulfillmentJob(jobId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "cancel_failed" }, { status: 400 })
  }

  const order = await loadAdminOrderDetail(line.orderId)
  return NextResponse.json({ ok: true, order })
}

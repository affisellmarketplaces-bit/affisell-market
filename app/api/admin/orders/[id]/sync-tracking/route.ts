import { type NextRequest, NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadAdminOrderDetail } from "@/lib/admin/orders/load-order"
import { syncSupplierFulfillmentOrderStatus } from "@/lib/suppliers/sync-order-status"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id: orderId } = await ctx.params
  const links = await prisma.supplierFulfillmentOrderLine.findMany({
    where: { orderId },
    select: { supplierFulfillmentOrderId: true },
  })
  const jobIds = [...new Set(links.map((l) => l.supplierFulfillmentOrderId))]

  const results = await Promise.all(jobIds.map((jid) => syncSupplierFulfillmentOrderStatus(jid)))
  const order = await loadAdminOrderDetail(orderId)

  return NextResponse.json({ results, order })
}

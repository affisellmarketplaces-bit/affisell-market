import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { authorizeAdminOrCron } from "@/lib/admin/authorize-admin-or-cron"
import { fulfillmentOrchestrator } from "@/lib/fulfillment/orchestrator"
import { resolveOrderAccessRole } from "@/lib/order-access"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

/**
 * GET /api/orders/[id]/tracking — unified multi-parcel tracking for checkout session.
 */
export async function GET(req: Request, ctx: RouteCtx) {
  const { id: orderId } = await ctx.params
  if (!orderId?.trim()) {
    return NextResponse.json({ error: "missing_order_id" }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId.trim() },
    select: {
      id: true,
      supplierId: true,
      affiliateId: true,
      buyerUserId: true,
      customerEmail: true,
    },
  })
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const cron = await authorizeAdminOrCron(req)
  const session = await auth()
  if (!cron.ok) {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const role = resolveOrderAccessRole(order, session.user)
    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const tracking = await fulfillmentOrchestrator.getUnifiedTracking(orderId.trim())
  if (!tracking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, tracking })
}

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { cancelMarketplaceOrderByAdmin } from "@/lib/admin/orders/cancel-marketplace-order"
import { loadAdminOrderDetail } from "@/lib/admin/orders/load-order"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  cancelReason: z.string().max(500).optional(),
})

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id: orderId } = await ctx.params
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 })
  }

  const result = await cancelMarketplaceOrderByAdmin(orderId, parsed.data.cancelReason)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "cancel_failed" }, { status: 400 })
  }

  const order = await loadAdminOrderDetail(orderId)
  return NextResponse.json({ ok: true, emailSent: result.emailSent, order })
}

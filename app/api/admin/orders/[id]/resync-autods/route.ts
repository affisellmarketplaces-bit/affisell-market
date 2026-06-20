import { type NextRequest, NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadAdminOrderDetail } from "@/lib/admin/orders/load-order"
import { resyncAutoDsOrderByAffisellId } from "@/lib/autods/sync-open-orders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id: orderId } = await ctx.params
  const result = await resyncAutoDsOrderByAffisellId(orderId)
  const order = await loadAdminOrderDetail(orderId)

  if (result.skipped === "no_autods_order") {
    return NextResponse.json({ error: "No AutoDS order linked" }, { status: 400 })
  }

  return NextResponse.json({ result, order })
}

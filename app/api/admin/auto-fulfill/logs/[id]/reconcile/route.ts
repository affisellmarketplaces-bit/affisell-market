import { NextResponse } from "next/server"
import { z } from "zod"

import { reconcileInDoubtPurchase } from "@/lib/admin/auto-fulfill/reconcile-in-doubt-purchase"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  outcome: z.enum(["exists", "not_exists"]),
  supplierOrderId: z.string().max(64).optional(),
  note: z.string().max(500).optional(),
})

/**
 * POST /api/admin/auto-fulfill/logs/[id]/reconcile — the human way out of a purchase IN DOUBT (log stuck in BUYING), after
 * LOOKING at the AliExpress order list. Admin session only. `exists` needs the AliExpress order id; `not_exists` releases the
 * claim. Audited in AuditLog. Contacts nothing, buys nothing.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const { id } = await ctx.params
  const log = await prisma.fulfillmentLog.findUnique({ where: { id }, select: { orderId: true } })
  if (!log) {
    return NextResponse.json({ error: "log_not_found" }, { status: 404 })
  }

  const result = await reconcileInDoubtPurchase({
    orderId: log.orderId,
    outcome: parsed.data.outcome,
    supplierOrderId: parsed.data.supplierOrderId,
    note: parsed.data.note,
    actorId: auth.session.user.id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, outcome: result.outcome, orderId: result.orderId })
}

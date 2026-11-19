import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { loadOrderProcurementCost } from "@/lib/procurement-debits/register.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/**
 * ADMIN, read-only: stored price vs debited amount vs full cost of one order. The real cost is given ONLY when the
 * reconciliation is complete; otherwise the figures are provisional and the reasons say what is missing.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const { id } = await ctx.params
  const view = await loadOrderProcurementCost(id)
  if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(view)
}

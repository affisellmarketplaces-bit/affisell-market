import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { parseAllocationInput } from "@/lib/procurement-debits/register"
import { allocateProcurementDebit } from "@/lib/procurement-debits/register.server"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/**
 * ADMIN: reconciles (part of) a movement with ONE order — `{ orderId, amountCents (settled euros), basis, note }`.
 * Refused when it would allocate more than the movement, twice to the same order, a refund beyond the order's share of
 * its debit, or a movement whose settled euro amount is not known yet.
 */
export async function POST(req: Request, ctx: Ctx) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const parsed = parseAllocationInput(body)
  if (!parsed.ok) return NextResponse.json({ error: "invalid_body", fields: parsed.errors }, { status: 400 })
  const { id } = await ctx.params
  const result = await allocateProcurementDebit(id, parsed.value, gate.session.user.id)
  if (!result.ok) {
    const status = result.error === "register_unavailable" ? 503 : result.error === "not_found" || result.error === "order_not_found" ? 404 : 409
    return NextResponse.json(result, { status })
  }
  return NextResponse.json(result, { status: 201 })
}

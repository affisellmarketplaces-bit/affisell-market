import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { voidProcurementDebit } from "@/lib/procurement-debits/register.server"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** ADMIN: voids a movement recorded by mistake — `{ reason }` (≥ 3 chars). Never deletes; its allocations are revoked. */
export async function POST(req: Request, ctx: Ctx) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const body = (await req.json().catch(() => null)) as { reason?: unknown } | null
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : ""
  if (reason.length < 3) return NextResponse.json({ error: "reason_required" }, { status: 400 })
  const { id } = await ctx.params
  const result = await voidProcurementDebit(id, reason, gate.session.user.id)
  if (!result.ok) return NextResponse.json(result, { status: result.error === "not_found" ? 404 : result.error === "register_unavailable" ? 503 : 409 })
  return NextResponse.json(result)
}

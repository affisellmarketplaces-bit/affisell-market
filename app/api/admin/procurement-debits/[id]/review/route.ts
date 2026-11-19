import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { resolveProcurementReview } from "@/lib/procurement-debits/register.server"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/**
 * ADMIN: resolves a movement kept apart for review — `{ reason, parentDebitId? }`. A refund waiting for its capture
 * names it (same source; for Issuing the same card). Allocates nothing.
 */
export async function POST(req: Request, ctx: Ctx) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const body = (await req.json().catch(() => null)) as { reason?: unknown; parentDebitId?: unknown } | null
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : ""
  if (reason.length < 3) return NextResponse.json({ error: "reason_required" }, { status: 400 })
  const parentDebitId = typeof body?.parentDebitId === "string" && body.parentDebitId.trim() ? body.parentDebitId.trim().slice(0, 64) : null
  const { id } = await ctx.params
  const result = await resolveProcurementReview(id, { reason, parentDebitId }, gate.session.user.id)
  if (!result.ok) return NextResponse.json(result, { status: result.error === "not_found" ? 404 : result.error === "register_unavailable" ? 503 : 409 })
  return NextResponse.json(result)
}

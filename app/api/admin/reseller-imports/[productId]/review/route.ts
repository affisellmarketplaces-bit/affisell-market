import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { applyResellerImportReview } from "@/lib/reseller-import/review.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUS: Record<string, number> = {
  not_found: 404,
  not_a_reseller_import: 409,
  transition_not_allowed: 409,
}

/**
 * ADMIN decision on a reseller URL import: `{ "decision": "approve" | "reject", "note": "why" }`.
 * Approve records the review; the product is published (and requested listings listed) only when its blocking
 * product-safety data is complete — an approval never bypasses it. Reject keeps the product a draft and unlists it. A reason is required (audit trail).
 */
export async function POST(req: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  let body: { decision?: unknown; note?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const decision = body.decision === "approve" || body.decision === "reject" ? body.decision : null
  const note = typeof body.note === "string" ? body.note.trim() : ""
  if (!decision || note.length < 3) return NextResponse.json({ error: "invalid_body" }, { status: 400 })

  const { productId } = await context.params
  const result = await applyResellerImportReview({ productId, decision, note, adminId: gate.session.user.id })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 })
  return NextResponse.json(result)
}

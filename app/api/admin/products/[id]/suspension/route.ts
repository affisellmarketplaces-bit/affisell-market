import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { isSuspensionReason } from "@/lib/products/affisell-suspension"
import { liftProductSuspension, loadSuspensionView, suspendProduct } from "@/lib/products/affisell-suspension.server"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUS: Record<string, number> = { not_found: 404, already_suspended: 409, not_suspended: 409 }

/** ADMIN: commercial status of a product — supplier pause vs Affisell suspension, with the suspension history. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const { id } = await context.params
  const view = await loadSuspensionView(id)
  if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(view)
}

/**
 * ADMIN: `{ action: "suspend", reason, note }` takes the product off sale and records why;
 * `{ action: "lift", note }` lifts the suspension WITHOUT putting the product back on sale (the supplier decides).
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  let body: { action?: unknown; reason?: unknown; note?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const note = typeof body.note === "string" ? body.note.trim() : ""
  if (note.length < 3) return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  const { id } = await context.params
  const adminId = gate.session.user.id
  if (body.action === "suspend") {
    if (!isSuspensionReason(body.reason)) return NextResponse.json({ error: "invalid_body" }, { status: 400 })
    const result = await suspendProduct({ productId: id, adminId, reason: body.reason, note })
    if (!result.ok) return NextResponse.json(result, { status: STATUS[result.error] ?? 400 })
    return NextResponse.json(result)
  }
  if (body.action === "lift") {
    const result = await liftProductSuspension({ productId: id, adminId, note })
    if (!result.ok) return NextResponse.json(result, { status: STATUS[result.error] ?? 400 })
    return NextResponse.json(result)
  }
  return NextResponse.json({ error: "invalid_body" }, { status: 400 })
}

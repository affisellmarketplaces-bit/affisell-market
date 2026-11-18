import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { publishApprovedResellerImport } from "@/lib/reseller-import/review.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUS: Record<string, number> = { not_found: 404, not_approved: 409, already_live: 409, compliance_blocking: 422 }

/** ADMIN: publish an APPROVED reseller import once its blocking product-safety data is complete. `{ note }` required. */
export async function POST(req: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  let body: { note?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const note = typeof body.note === "string" ? body.note.trim() : ""
  if (note.length < 3) return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  const { productId } = await context.params
  const result = await publishApprovedResellerImport({ productId, adminId: gate.session.user.id, note })
  if (!result.ok) return NextResponse.json(result, { status: STATUS[result.error] ?? 400 })
  return NextResponse.json(result)
}

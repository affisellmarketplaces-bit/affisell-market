import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { updateResellerImportCompliance } from "@/lib/reseller-import/review.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUS: Record<string, number> = { not_found: 404, already_live: 409, invalid_body: 400 }

/** ADMIN: complete the product-safety data of a reseller import that is not live. `{ values: { key: value } }`. */
export async function PUT(req: Request, context: { params: Promise<{ productId: string }> }): Promise<Response> {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  let body: { values?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  if (!body.values || typeof body.values !== "object" || Array.isArray(body.values)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const { productId } = await context.params
  const result = await updateResellerImportCompliance({
    productId,
    adminId: gate.session.user.id,
    values: body.values as Record<string, unknown>,
  })
  if (!result.ok) return NextResponse.json(result, { status: STATUS[result.error] ?? 400 })
  return NextResponse.json(result)
}

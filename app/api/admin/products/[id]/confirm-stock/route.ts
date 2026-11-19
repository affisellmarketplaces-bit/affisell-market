import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { confirmImportedStock } from "@/lib/import-stock.server"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUS: Record<string, number> = {
  not_found: 404,
  not_unconfirmed: 409,
  has_variant_rows: 409,
  invalid_stock: 400,
  invalid_note: 400,
}

/**
 * ADMIN: confirm the quantity of an imported product whose source gave none — `{ stock, note }` (reason required).
 * Lifts the « quantity to confirm » marker; does NOT publish (publication stays its own explicit step).
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const body = (await req.json().catch(() => null)) as { stock?: unknown; note?: unknown } | null
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  const { id } = await context.params
  const result = await confirmImportedStock({ productId: id, adminId: gate.session.user.id, stock: body.stock, note: body.note })
  if (!result.ok) return NextResponse.json(result, { status: STATUS[result.error] ?? 400 })
  return NextResponse.json(result)
}

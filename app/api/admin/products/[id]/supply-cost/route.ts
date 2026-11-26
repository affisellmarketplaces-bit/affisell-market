import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { loadAdminSupplierCostReview, recordCostQualification } from "@/lib/supplier-costs/declaration.server"
import { checkQualificationRequest } from "@/lib/supplier-costs/qualification"
import { parseVariantKeyField } from "@/lib/supplier-costs/variant-key"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** ADMIN, read-only: the supplier's cost declarations, their qualification, and the comparison with recorded costs. */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const { id } = await ctx.params
  const review = await loadAdminSupplierCostReview(id)
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(review)
}

/** ADMIN: qualify the CURRENT declaration — `{ state: "verified" | "disputed" | "expired", note }` (reason required). */
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
  const checked = checkQualificationRequest("admin", body)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })
  const variant = parseVariantKeyField(body)
  if (!variant.ok) return NextResponse.json({ error: "variant_invalid" }, { status: 400 })
  const { id } = await ctx.params
  const result = await recordCostQualification({
    variantKey: variant.value,
    productId: id,
    actor: "admin",
    actorId: gate.session.user.id,
    supplierId: null,
    request: checked.value,
  })
  if (!result.ok) return NextResponse.json(result, { status: result.error === "not_found" ? 404 : 409 })
  return NextResponse.json(result)
}

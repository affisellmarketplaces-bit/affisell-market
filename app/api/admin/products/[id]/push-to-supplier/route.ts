import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { pushProductToSupplier } from "@/lib/admin/products/push-product-to-supplier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  targetSupplierId: z.string().min(1),
  publish: z.boolean().optional(),
  force: z.boolean().optional(),
})

/**
 * POST /api/admin/products/[id]/push-to-supplier
 * Push AutoBuy product onto a chosen supplier boutique (reassign ownership).
 */
export async function POST(req: Request, context: RouteContext) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { id } = await context.params

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const result = await pushProductToSupplier({
    productId: id,
    targetSupplierId: parsed.data.targetSupplierId,
    publish: parsed.data.publish,
    force: parsed.data.force,
    adminUserId: gate.session.user.id,
  })

  if (!result.ok) {
    const status =
      result.error === "product_not_found" || result.error === "supplier_not_found"
        ? 404
        : result.error === "ownership_conflict"
          ? 409
          : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result)
}

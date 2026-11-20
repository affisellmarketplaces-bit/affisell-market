import { auth } from "@/auth"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { recordCostQualification } from "@/lib/supplier-costs/declaration.server"
import { checkQualificationRequest } from "@/lib/supplier-costs/qualification"
import { parseVariantKeyField } from "@/lib/supplier-costs/variant-key"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/**
 * SUPPLIER: « I have provided a supporting document » for the CURRENT cost declaration of its own product, with a
 * description (`{ state: "document_provided", note }`). A claim, not a verification — Affisell verifies separately.
 */
export async function POST(req: Request, ctx: Ctx) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Not authenticated" }, { status: 401 })
  if ((session.user as { role?: string }).role !== "SUPPLIER") return Response.json({ error: "Forbidden" }, { status: 403 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 })
  }
  const checked = checkQualificationRequest("supplier", body)
  if (!checked.ok) return Response.json({ error: checked.error }, { status: checked.error === "not_allowed_for_actor" ? 403 : 400 })
  const variant = parseVariantKeyField(body)
  if (!variant.ok) return Response.json({ error: "variant_invalid" }, { status: 400 })
  const { id } = await ctx.params
  const result = await recordCostQualification({
    variantKey: variant.value,
    productId: id,
    actor: "supplier",
    actorId: session.user.id,
    supplierId: session.user.id,
    request: checked.value,
  })
  if (!result.ok) return Response.json(result, { status: result.error === "not_found" ? 404 : 409 })
  return Response.json(result)
}

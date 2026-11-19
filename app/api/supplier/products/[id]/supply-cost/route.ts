import { auth } from "@/auth"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { parseEffectiveFrom, parseSupplierCostInput } from "@/lib/supplier-costs/declaration"
import { parseVariantKeyField } from "@/lib/supplier-costs/variant-key"
import { declareSupplierCost, loadSupplierCostView } from "@/lib/supplier-costs/declaration.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

async function requireSupplier() {
  const session = await auth()
  if (!session?.user?.id) return { error: Response.json({ error: "Not authenticated" }, { status: 401 }) }
  if ((session.user as { role?: string }).role !== "SUPPLIER") return { error: Response.json({ error: "Forbidden" }, { status: 403 }) }
  return { supplierId: session.user.id }
}

/** The supplier's own confidential supply-cost declaration for one of its products (current + history). */
export async function GET(_req: Request, ctx: Ctx) {
  const who = await requireSupplier()
  if (who.error) return who.error
  const { id } = await ctx.params
  const view = await loadSupplierCostView(id, who.supplierId)
  if (!view) return Response.json({ error: "Product not found" }, { status: 404 })
  // The supplier sees what was decided and why, not which Affisell account decided it.
  return Response.json({ ...view, qualificationEvents: view.qualificationEvents.map(({ by: _by, ...e }) => e) })
}

/**
 * Declare / update — for the whole product, or for one variant (`variantKey`), from `effectiveFrom` (default now, never
 * in the past). Never changes the price, the commission, the stock or the publication of the product.
 */
export async function PUT(req: Request, ctx: Ctx) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const who = await requireSupplier()
  if (who.error) return who.error
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 })
  }
  const parsed = parseSupplierCostInput(body)
  if (!parsed.ok) return Response.json({ error: "invalid_body", fields: parsed.errors }, { status: 400 })
  const effective = parseEffectiveFrom((body as Record<string, unknown> | null)?.effectiveFrom, new Date())
  if (!effective.ok) return Response.json({ error: "invalid_body", fields: [effective.error] }, { status: 400 })
  const variant = parseVariantKeyField(body)
  if (!variant.ok) return Response.json({ error: "invalid_body", fields: ["variant_invalid"] }, { status: 400 })
  const { id } = await ctx.params
  const result = await declareSupplierCost({
    productId: id,
    supplierId: who.supplierId,
    value: parsed.value,
    effectiveFrom: effective.value,
    variantKey: variant.value,
  })
  if (!result.ok) {
    if (result.error === "variant_unknown") return Response.json({ error: "variant_unknown" }, { status: 409 })
    return Response.json({ error: "Product not found" }, { status: 404 })
  }
  return Response.json(result)
}

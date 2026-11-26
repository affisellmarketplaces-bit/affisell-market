import { auth } from "@/auth"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { confirmSupplierStock } from "@/lib/supplier-catalog-health/stockout-forecast.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * SUPPLIER: « the quantity shown is right » — dated, recorded, the quantity itself is NEVER changed here (a different
 * figure goes through the product form). Body `{ units }` = the figure the supplier saw; refused when it changed.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Not authenticated" }, { status: 401 })
  if ((session.user as { role?: string }).role !== "SUPPLIER") return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as { units?: unknown } | null
  const units = body?.units
  if (typeof units !== "number" || !Number.isInteger(units) || units < 0 || units > 10_000_000) {
    return Response.json({ error: "invalid_body" }, { status: 400 })
  }
  const r = await confirmSupplierStock({ supplierId: session.user.id, productId: id, units })
  if (r.ok) return Response.json(r)
  const status = r.error === "not_found" ? 404 : 409
  return Response.json({ error: r.error }, { status })
}

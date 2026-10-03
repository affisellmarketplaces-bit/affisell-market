import { auth } from "@/auth"
import {
  cancelExclusivityRequest,
  loadAffiliateProductExclusivityState,
  releaseProductExclusivity,
  requestProductExclusivity,
} from "@/lib/product-exclusivity.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** `[id]` is the PRODUCT id (the dynamic segment name is fixed by the sibling routes under /products/[id]). */
type Ctx = { params: Promise<{ id: string }> }

async function requireAffiliate() {
  const session = await auth()
  if (!session?.user?.id) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.role !== "AFFILIATE") return { error: Response.json({ error: "Forbidden" }, { status: 403 }) }
  return { affiliateId: session.user.id }
}

/** What this reseller sees for the product: none | requested | mine | other. */
export async function GET(_req: Request, ctx: Ctx) {
  const who = await requireAffiliate()
  if (who.error) return who.error
  const { id: productId } = await ctx.params

  const view = await loadAffiliateProductExclusivityState(who.affiliateId, productId)
  if (!view) return Response.json({ error: "Product not found" }, { status: 404 })
  return Response.json({ state: view.state, until: view.until?.toISOString() ?? null })
}

/** Ask the supplier for exclusivity on this product. */
export async function POST(req: Request, ctx: Ctx) {
  const who = await requireAffiliate()
  if (who.error) return who.error
  const { id: productId } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as { message?: unknown }

  const result = await requestProductExclusivity({ affiliateId: who.affiliateId, productId, message: body.message })
  if (result.ok) return Response.json({ ok: true }, { status: 201 })
  const status =
    result.error === "product_not_found" ? 404 : result.error === "no_store" || result.error === "own_product" ? 400 : 409
  return Response.json({ error: result.error }, { status })
}

/** Release a held exclusivity, or withdraw a pending request. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const who = await requireAffiliate()
  if (who.error) return who.error
  const { id: productId } = await ctx.params

  const released = await releaseProductExclusivity({ affiliateId: who.affiliateId, productId })
  if (released.ok) return Response.json({ ok: true, released: true })
  if (released.error === "not_exclusive") {
    // Nothing to release: withdraw an open request instead (the same "give it up" gesture from the UI).
    const cancelled = await cancelExclusivityRequest({ affiliateId: who.affiliateId, productId })
    if (cancelled) return Response.json({ ok: true, cancelled: true })
  }
  const status = released.error === "product_not_found" ? 404 : released.error === "not_holder" ? 403 : 409
  return Response.json({ error: released.error }, { status })
}

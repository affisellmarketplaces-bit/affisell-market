import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  declineExclusivityRequest,
  grantProductExclusivity,
  loadSupplierProductExclusivity,
  revokeProductExclusivity,
} from "@/lib/product-exclusivity.server"
import {
  EXCLUSIVITY_DEFAULT_DAYS,
  EXCLUSIVITY_MAX_DAYS,
  EXCLUSIVITY_MIN_DAYS,
  EXCLUSIVITY_SUPPLIER_REVOKE_WINDOW_HOURS,
} from "@/lib/product-exclusivity-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

async function requireSupplier() {
  const session = await auth()
  if (!session?.user?.id) return { error: Response.json({ error: "Not authenticated" }, { status: 401 }) }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { supplierId: session.user.id }
}

/** Current exclusivity, pending reseller requests and the rules the UI should state. */
export async function GET(_req: Request, ctx: Ctx) {
  const who = await requireSupplier()
  if (who.error) return who.error
  const { id } = await ctx.params

  const view = await loadSupplierProductExclusivity(who.supplierId, id)
  if (!view) return Response.json({ error: "Product not found" }, { status: 404 })

  return Response.json({
    holder: view.holder
      ? {
          ...view.holder,
          grantedAt: view.holder.grantedAt?.toISOString() ?? null,
          until: view.holder.until.toISOString(),
        }
      : null,
    requests: view.requests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    liveListings: view.liveListings,
    rules: {
      minDays: EXCLUSIVITY_MIN_DAYS,
      maxDays: EXCLUSIVITY_MAX_DAYS,
      defaultDays: EXCLUSIVITY_DEFAULT_DAYS,
      revokeWindowHours: EXCLUSIVITY_SUPPLIER_REVOKE_WINDOW_HOURS,
    },
  })
}

/**
 * `{ action: "grant", requestId | affiliateId | storeSlug, days?, evictOthers? }` or `{ action: "decline", requestId }`.
 */
export async function POST(req: Request, ctx: Ctx) {
  const who = await requireSupplier()
  if (who.error) return who.error
  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : ""

  if (body.action === "decline") {
    if (!requestId) return Response.json({ error: "requestId required" }, { status: 400 })
    const res = await declineExclusivityRequest({ supplierId: who.supplierId, requestId })
    return res.ok ? Response.json({ ok: true }) : Response.json({ error: "Request not found" }, { status: 404 })
  }

  if (body.action !== "grant") return Response.json({ error: "Unknown action" }, { status: 400 })

  let affiliateId = typeof body.affiliateId === "string" ? body.affiliateId.trim() : ""
  if (requestId) {
    const request = await prisma.productExclusivityRequest.findFirst({
      where: { id: requestId, productId: id, supplierId: who.supplierId, status: "PENDING" },
      select: { affiliateId: true },
    })
    if (!request) return Response.json({ error: "Request not found" }, { status: 404 })
    affiliateId = request.affiliateId
  }
  const storeSlug = typeof body.storeSlug === "string" ? body.storeSlug.trim().toLowerCase() : ""
  if (!affiliateId && storeSlug) {
    const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { userId: true } })
    if (!store) return Response.json({ error: "store_not_found" }, { status: 404 })
    affiliateId = store.userId
  }
  if (!affiliateId) return Response.json({ error: "affiliateId, storeSlug or requestId required" }, { status: 400 })

  const result = await grantProductExclusivity({
    supplierId: who.supplierId,
    productId: id,
    affiliateId,
    days: body.days,
    evictOthers: body.evictOthers === true,
  })

  if (result.ok) {
    return Response.json({
      ok: true,
      until: result.until.toISOString(),
      extended: result.extended,
      evicted: result.evicted,
    })
  }
  switch (result.error) {
    case "product_not_found":
      return Response.json({ error: result.error }, { status: 404 })
    case "affiliate_not_eligible":
      return Response.json({ error: result.error }, { status: 400 })
    case "other_listings":
      return Response.json({ error: result.error, otherListings: result.otherListings }, { status: 409 })
    case "held_by_other":
      return Response.json({ error: result.error, until: result.until?.toISOString() }, { status: 409 })
    default:
      return Response.json({ error: result.error }, { status: 409 })
  }
}

/** Undo a grant — allowed only inside the cooling-off window; afterwards only the holder can release. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const who = await requireSupplier()
  if (who.error) return who.error
  const { id } = await ctx.params

  const result = await revokeProductExclusivity({ supplierId: who.supplierId, productId: id })
  if (result.ok) return Response.json({ ok: true })
  const status = result.error === "product_not_found" ? 404 : result.error === "revoke_window_closed" ? 403 : 409
  return Response.json({ error: result.error }, { status })
}

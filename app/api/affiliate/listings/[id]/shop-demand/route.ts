import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { chooseShopDemandAlternative, loadShopDemandAlternatives } from "@/lib/restock-watch/shop-demand.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function reseller() {
  const session = await auth()
  if (!session?.user?.id) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  if (session.user.role !== "AFFILIATE") return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) }
  return { id: session.user.id }
}

/**
 * RESELLER, own listing only: the shop's demand for ONE waited variant (`?variant=<key>`, distinct buyers of THIS shop,
 * from 3) and up to three alternatives that really serve that same variant, with the real net per sale. Read-only
 * (records that the proposal was shown, counts only).
 */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const who = await reseller()
  if (who.error) return who.error
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, who.id), { prefix: "shop-demand-alts", limit: 30, windowMs: 60_000 })
  if (limited) return limited
  const { id } = await context.params
  const variantKey = new URL(req.url).searchParams.get("variant") ?? ""
  try {
    const r = await loadShopDemandAlternatives(who.id, id, variantKey)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "not_found" ? 404 : 400 })
    return NextResponse.json({ demand: r.demand, proposal: r.proposal })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}

/**
 * RESELLER chooses to OFFER an alternative in its shop: `{ variantKey, productId, confirm: true }`. Adds it through the
 * existing quick add (or finds it already live). The requested listing and the buyers' requests are left as they are:
 * nothing is replaced, nothing is sent to buyers.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const who = await reseller()
  if (who.error) return who.error
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, who.id), { prefix: "shop-demand-choose", limit: 10, windowMs: 60_000 })
  if (limited) return limited
  const { id } = await context.params
  const body = (await req.json().catch(() => null)) as { variantKey?: unknown; productId?: unknown; confirm?: unknown } | null
  if (!body || typeof body.variantKey !== "string" || typeof body.productId !== "string") return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  try {
    const r = await chooseShopDemandAlternative({ affiliateId: who.id, listingId: id, variantKey: body.variantKey, productId: body.productId, confirm: body.confirm === true })
    if (r.ok) return NextResponse.json(r)
    const status = r.error === "not_found" ? 404 : r.error === "not_confirmed" ? 400 : r.status ?? 409
    return NextResponse.json({ error: r.error, message: r.message }, { status })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}

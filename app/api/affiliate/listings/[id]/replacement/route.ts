import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import {
  finishReplacement,
  loadPendingReplacement,
  loadReplacementProposal,
  replaceListing,
  withdrawListing,
} from "@/lib/reseller-replacement/replace.server"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function reseller() {
  const session = await auth()
  if (!session?.user?.id) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  if (session.user.role !== "AFFILIATE") return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) }
  return { id: session.user.id }
}

/** RESELLER, read-only: why this listing can not be sold and up to three really equivalent alternatives. */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const who = await reseller()
  if (who.error) return who.error
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, who.id), { prefix: "listing-replace-read", limit: 30, windowMs: 60_000 })
  if (limited) return limited
  const { id } = await context.params
  const loaded = await loadReplacementProposal(who.id, id)
  if (!loaded.ok) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const pendingReplacement = await loadPendingReplacement(who.id, id, loaded.listingIsListed)
  return NextResponse.json({ ...loaded.proposal, listingIsListed: loaded.listingIsListed, pendingReplacement })
}

/**
 * RESELLER confirms: `{ action: "replace", productId, confirm: true }`, `{ action: "withdraw", confirm: true }` or
 * `{ action: "finish", productId, confirm: true }` (a replacement whose alternative was added but whose old listing is
 * still in the shop: withdraws the old listing only, never re-adds).
 * Nothing is deleted; the old listing keeps its history, statistics and orders.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const who = await reseller()
  if (who.error) return who.error
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, who.id), { prefix: "listing-replace", limit: 10, windowMs: 60_000 })
  if (limited) return limited
  const body = (await req.json().catch(() => null)) as { action?: unknown; productId?: unknown; confirm?: unknown } | null
  if (!body || body.confirm !== true) return NextResponse.json({ error: "not_confirmed" }, { status: 400 })
  const { id } = await context.params
  if (body.action === "withdraw") {
    const r = await withdrawListing(who.id, id)
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  if (body.action === "finish") {
    if (typeof body.productId !== "string" || !body.productId.trim()) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 })
    }
    const f = await finishReplacement({ affiliateId: who.id, listingId: id, productId: body.productId.trim(), confirm: true })
    if (!f.ok) return NextResponse.json(f, { status: f.error === "not_found" ? 404 : 409 })
    return NextResponse.json(f)
  }
  if (body.action !== "replace" || typeof body.productId !== "string" || !body.productId.trim()) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const r = await replaceListing({ affiliateId: who.id, listingId: id, productId: body.productId.trim(), confirm: true })
  if (!r.ok) {
    const status = r.error === "not_found" ? 404 : r.error === "alternative_not_offered" ? 409 : r.error === "add_failed" || r.error === "replacement_pending" ? 409 : 400
    return NextResponse.json(r, { status })
  }
  return NextResponse.json(r)
}

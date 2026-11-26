import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { sanitizeAddRequest } from "@/lib/reseller-copilot/selection"
import { addSelection, loadResellerSelection } from "@/lib/reseller-copilot/selection.server"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function reseller() {
  const session = await auth()
  if (!session?.user?.id) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  if (session.user.role !== "AFFILIATE") return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) }
  return { id: session.user.id }
}

/** RESELLER, read-only: the copilot's ready-to-sell selection (real net per sale, readiness, observed demand). */
export async function GET(req: Request) {
  const who = await reseller()
  if (who.error) return who.error
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, who.id), { prefix: "copilot-selection", limit: 30, windowMs: 60_000 })
  if (limited) return limited
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 12)
  return NextResponse.json(await loadResellerSelection(who.id, Number.isFinite(limit) ? limit : 12))
}

/**
 * RESELLER: adds the products it kept (`{ productIds }`, ≤ 20) to its shop through the existing quick add — each one
 * re-assessed first; a product that can no longer be sold is refused, never added.
 */
export async function POST(req: Request) {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const who = await reseller()
  if (who.error) return who.error
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, who.id), { prefix: "copilot-add", limit: 10, windowMs: 60_000 })
  if (limited) return limited
  const ids = sanitizeAddRequest(await req.json().catch(() => null))
  if (!ids) return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  const results = await addSelection(who.id, ids)
  return NextResponse.json({ results, added: results.filter((r) => r.ok).length })
}

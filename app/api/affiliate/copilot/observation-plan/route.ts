import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadPlanPreview } from "@/lib/reseller-copilot/observation-plan.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/affiliate/copilot/observation-plan?productId= — the INDICATIVE observation plan of a product the signed-in
 * reseller may add (shown in « Pourquoi ce produit ? »). Read-only, writes nothing. `{ plan: null, silence }` when no
 * horizon can be justified; `{ plan: null, silence: null }` while `OBSERVATION_PLAN_MODE` is not `on` (or hold-out).
 * Aggregates of OTHER resellers only (≥ 3), never a name, a sales figure or an amount of anyone else.
 */
export async function GET(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session?.user?.role !== "AFFILIATE") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), { prefix: "observation-plan", limit: 60, windowMs: 60_000 })
  if (limited) return limited
  const productId = new URL(req.url).searchParams.get("productId")?.trim() ?? ""
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(productId)) return NextResponse.json({ error: "invalid_product" }, { status: 400 })
  const d = await loadPlanPreview(userId, productId)
  return NextResponse.json({ plan: d?.plan ?? null, silence: d?.silence ?? null }, { headers: { "Cache-Control": "no-store" } })
}

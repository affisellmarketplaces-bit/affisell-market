import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { commitResellerUrlImport } from "@/lib/affiliate-url-import.server"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Commit scraped URL into AffiliateProduct (+ vault Product). AFFILIATE only. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized", code: "auth_required" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return NextResponse.json(
      { error: "Compte revendeur requis", code: "affiliate_required" },
      { status: 403 }
    )
  }

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), {
    limit: 30,
    windowMs: 60 * 60 * 1000,
    prefix: "affiliate-import-url-commit",
  })
  if (limited) return limited

  const body = (await req.json().catch(() => ({}))) as {
    url?: string
    sellingPriceEur?: number
    titleOverride?: string
    listLive?: boolean
    snapshot?: unknown
  }
  const url = typeof body.url === "string" ? body.url.trim() : ""
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 })
  }

  const result = await commitResellerUrlImport({
    affiliateId: session.user.id,
    affiliateEmail: session.user.email ?? `${session.user.id}@affisell.local`,
    affiliateName: session.user.name,
    sourceUrl: url,
    sellingPriceEur:
      typeof body.sellingPriceEur === "number" && Number.isFinite(body.sellingPriceEur)
        ? body.sellingPriceEur
        : undefined,
    titleOverride:
      typeof body.titleOverride === "string" ? body.titleOverride : undefined,
    listLive: body.listLive === true,
    snapshot: body.snapshot,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  try {
    await revalidateAffiliateShopfront(session.user.id)
  } catch (e) {
    console.warn("[affiliate-url-import]", {
      stage: "revalidate",
      error: e instanceof Error ? e.message : String(e),
    })
  }

  return NextResponse.json({
    ok: true,
    productId: result.productId,
    affiliateProductId: result.affiliateProductId,
    storeSlug: result.storeSlug,
    shopHref: result.shopHref,
    editHref: result.editHref,
    isListed: result.isListed,
  })
}

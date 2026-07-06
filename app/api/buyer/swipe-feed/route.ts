import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { loadBuyerSwipeFeedItems } from "@/lib/buyer-swipe-feed.server"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const takeRaw = request.nextUrl.searchParams.get("take")
    const take = takeRaw ? Math.min(48, Math.max(6, Number(takeRaw) || 24)) : 24
    const sp = request.nextUrl.searchParams
    const isPublicDefault =
      !sp.get("category")?.trim() &&
      !sp.get("subcategory")?.trim() &&
      !sp.get("q")?.trim() &&
      take === 24
    const products = await loadBuyerSwipeFeedItems(request.nextUrl.searchParams, { limit: take })
    const res = NextResponse.json({ products })
    if (isPublicDefault) {
      res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120")
    }
    return res
  } catch (e) {
    console.error("[buyer/swipe-feed]", e)
    return NextResponse.json({ products: [], ...dbUnavailablePayload(e) }, { status: 503 })
  }
}

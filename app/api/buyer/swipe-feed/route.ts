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
    const products = await loadBuyerSwipeFeedItems(request.nextUrl.searchParams, { limit: take })
    return NextResponse.json({ products })
  } catch (e) {
    console.error("[buyer/swipe-feed]", e)
    return NextResponse.json({ products: [], ...dbUnavailablePayload(e) }, { status: 503 })
  }
}

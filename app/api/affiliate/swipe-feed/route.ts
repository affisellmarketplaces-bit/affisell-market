import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { loadSwipeFeedProducts } from "@/lib/affiliate-swipe-feed.server"
import type { SwipeFeedFilters } from "@/lib/affiliate-swipe-feed-types"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseFilters(searchParams: URLSearchParams): SwipeFeedFilters {
  const minRaw = searchParams.get("minCommission")
  const minCommission = minRaw ? Number(minRaw) : undefined
  return {
    categoryId: searchParams.get("categoryId") ?? searchParams.get("category") ?? undefined,
    niche: searchParams.get("niche") ?? undefined,
    q: searchParams.get("q")?.trim() || undefined,
    minCommission:
      minCommission != null && Number.isFinite(minCommission) && minCommission > 0
        ? Math.round(minCommission)
        : undefined,
  }
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (String(session.user.role ?? "").toUpperCase() !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const takeRaw = request.nextUrl.searchParams.get("take")
    const take = takeRaw ? Math.min(48, Math.max(3, Number(takeRaw) || 12)) : 12
    const filters = parseFilters(request.nextUrl.searchParams)
    const products = await loadSwipeFeedProducts(session.user.id, filters, take)
    return NextResponse.json({ products, filters })
  } catch (e) {
    console.error("[affiliate/swipe-feed]", e)
    return NextResponse.json({ products: [], ...dbUnavailablePayload(e) }, { status: 503 })
  }
}

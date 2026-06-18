import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { loadOfferModeRailCounts } from "@/lib/marketplace-discovery-facets"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"
import { withPrismaReconnect } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const scopeRootId = sp.get("subcategoryId") ?? sp.get("subcategory") ?? sp.get("categoryId") ?? sp.get("category")
    const counts = await withPrismaReconnect(() => loadOfferModeRailCounts(scopeRootId))
    return NextResponse.json(
      { counts },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } }
    )
  } catch (e) {
    console.error("[api/marketplace/offer-rail-counts]", e)
    return NextResponse.json({ counts: {}, ...dbUnavailablePayload(e) }, { status: 503 })
  }
}

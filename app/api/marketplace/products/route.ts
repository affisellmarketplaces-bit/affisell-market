import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { fetchMarketplaceListings } from "@/lib/marketplace-listings-query"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"
import { withPrismaReconnect } from "@/lib/prisma"

export const runtime = "nodejs"
export const revalidate = 60

export async function GET(request: NextRequest) {
  const hasFilters = request.nextUrl.search.length > 0
  try {
    const products = await withPrismaReconnect(() =>
      fetchMarketplaceListings(request.nextUrl.searchParams)
    )
    return NextResponse.json(
      { products },
      {
        headers: hasFilters
          ? { "Cache-Control": "private, no-store" }
          : { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180" },
      }
    )
  } catch (e) {
    console.error("[api/marketplace/products]", e)
    return NextResponse.json({ products: [], ...dbUnavailablePayload(e) }, { status: 503 })
  }
}

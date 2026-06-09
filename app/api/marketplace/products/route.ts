import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { fetchMarketplaceListings } from "@/lib/marketplace-listings-query"
import { resolveMarketplaceProductsFetchOptions } from "@/lib/marketplace-products-request"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"
import { withPrismaReconnect } from "@/lib/prisma"

export const runtime = "nodejs"
export const revalidate = 60

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const { lite, take, hasFilters } = resolveMarketplaceProductsFetchOptions(searchParams)
  // `lite` is an API transport flag — it must never reach the product where-builders.
  const filterParams = new URLSearchParams(searchParams.toString())
  filterParams.delete("lite")
  try {
    const products = await withPrismaReconnect(() =>
      fetchMarketplaceListings(filterParams, take, { lite })
    )
    return NextResponse.json(
      { products },
      {
        headers: hasFilters
          ? { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" }
          : { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180" },
      }
    )
  } catch (e) {
    console.error("[api/marketplace/products]", e)
    return NextResponse.json({ products: [], ...dbUnavailablePayload(e) }, { status: 503 })
  }
}

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { fetchMarketplaceListings } from "@/lib/marketplace-listings-query"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const products = await fetchMarketplaceListings(request.nextUrl.searchParams)
    return NextResponse.json({ products })
  } catch (e) {
    console.error("[api/marketplace/products]", e)
    return NextResponse.json({ products: [], ...dbUnavailablePayload(e) }, { status: 503 })
  }
}

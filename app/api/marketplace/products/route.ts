import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { resolveAppLocale } from "@/lib/i18n-locale"
import { translateItemTitles } from "@/lib/title-translation.server"
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
  // Buyer language for titles — a display concern, not a filter (and part of the CDN cache key via the URL).
  const rawLocale = filterParams.get("locale")
  filterParams.delete("locale")
  const locale = resolveAppLocale(rawLocale)
  try {
    const products = await withPrismaReconnect(() =>
      fetchMarketplaceListings(filterParams, take, { lite })
    )
    const translated = rawLocale ? await translateItemTitles(products, locale) : products
    return NextResponse.json(
      { products: translated },
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

import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { LOCALE_COOKIE, resolveAppLocale } from "@/lib/i18n-locale"
import { loadMarketplaceCategoryTreeCached } from "@/lib/marketplace-category-tree"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"

export const revalidate = 120

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
}

/**
 * Category tree for marketplace sidebar + department rail.
 * `count` = live listed SKUs in that department (subtree) or sub-aisle.
 */
export async function GET() {
  const cookieStore = await cookies()
  const locale = resolveAppLocale(cookieStore.get(LOCALE_COOKIE)?.value)

  try {
    const tree = await loadMarketplaceCategoryTreeCached(locale)
    return NextResponse.json(
      {
        categories: tree.categories,
        locale: tree.locale,
        catalogTotal: tree.catalogTotal,
        staticFallback: tree.staticFallback,
      },
      { headers: CACHE_HEADERS }
    )
  } catch (e) {
    console.error("[api/categories]", e)
    return NextResponse.json({
      categories: [],
      locale,
      catalogTotal: 0,
      staticFallback: true,
      ...dbUnavailablePayload(e),
    })
  }
}

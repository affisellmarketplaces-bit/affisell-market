import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { parseMarketplaceAttributeFilters } from "@/lib/marketplace-attribute-filters"
import {
  loadMarketplaceFacets,
  resolveFilterableCategoryAttributes,
} from "@/lib/marketplace-attribute-filters.server"
import {
  loadProductCustomColumnFacets,
  parseProductCustomColumnFilters,
} from "@/lib/product-custom-column-filters"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"
import { withPrismaReconnect } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const categoryId = sp.get("categoryId") ?? sp.get("category")
    const subcategoryId = sp.get("subcategoryId") ?? sp.get("subcategory")
    const scopeRootId = subcategoryId ?? categoryId

    if (!scopeRootId?.trim()) {
      return NextResponse.json([])
    }

    const scope = scopeRootId.trim()
    const defs = await withPrismaReconnect(() => resolveFilterableCategoryAttributes(scope))
    const allowedKeys = new Set(defs.map((d) => d.key))
    const attributeFilters = parseMarketplaceAttributeFilters(sp, allowedKeys)
    const categoryFacets = await withPrismaReconnect(() =>
      loadMarketplaceFacets(scope, attributeFilters, defs)
    )
    const ccFilters = parseProductCustomColumnFilters(sp)
    const customFacets = await withPrismaReconnect(() =>
      loadProductCustomColumnFacets(scope, ccFilters)
    )

    return NextResponse.json([...categoryFacets, ...customFacets])
  } catch (e) {
    console.error("[api/marketplace/facets]", e)
    return NextResponse.json({ facets: [], ...dbUnavailablePayload(e) }, { status: 503 })
  }
}

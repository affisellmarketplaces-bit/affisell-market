import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import {
  loadMarketplaceFacets,
  parseMarketplaceAttributeFilters,
  resolveFilterableCategoryAttributes,
} from "@/lib/marketplace-attribute-filters"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"

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

    const defs = await resolveFilterableCategoryAttributes(scopeRootId.trim())
    const allowedKeys = new Set(defs.map((d) => d.key))
    const attributeFilters = parseMarketplaceAttributeFilters(sp, allowedKeys)
    const facets = await loadMarketplaceFacets(scopeRootId.trim(), attributeFilters, defs)

    return NextResponse.json(facets)
  } catch (e) {
    console.error("[api/marketplace/facets]", e)
    return NextResponse.json({ facets: [], ...dbUnavailablePayload(e) }, { status: 503 })
  }
}

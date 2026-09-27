import { NextResponse } from "next/server"

import { countFacetValues } from "@/lib/marketplace-attribute-filters.server"

export const revalidate = 120

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
}

const MAX_BRANDS = 8

/** Live "Shop by brand" panel for a category's mega-menu flyout — real listed inventory, not a static logo wall. */
export async function GET(_req: Request, ctx: { params: Promise<{ categoryId: string }> }) {
  const { categoryId: rawCategoryId } = await ctx.params
  const categoryId = rawCategoryId?.trim()
  if (!categoryId) {
    return NextResponse.json({ brands: [] }, { headers: CACHE_HEADERS })
  }

  try {
    const values = await countFacetValues("brand", categoryId, {})
    return NextResponse.json({ brands: values.slice(0, MAX_BRANDS) }, { headers: CACHE_HEADERS })
  } catch (e) {
    console.error("[api/categories/brands]", e)
    return NextResponse.json({ brands: [] }, { headers: CACHE_HEADERS })
  }
}

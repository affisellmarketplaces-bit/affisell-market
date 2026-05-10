import { NextResponse } from "next/server"

import {
  genericFallbackRows,
  resolveCategoryAttributesForForm,
} from "@/lib/category-attribute-resolution"
import { mergeMarketplaceStyleSupplements } from "@/lib/marketplace-style-spec-supplements"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get("categoryId")

  if (!categoryId) {
    return NextResponse.json({ error: "categoryId required" }, { status: 400 })
  }

  try {
    const attributes = await resolveCategoryAttributesForForm(categoryId)
    return NextResponse.json({ attributes })
  } catch (e) {
    console.error("[api/attributes/by-category]", e)
    return NextResponse.json({
      attributes: mergeMarketplaceStyleSupplements(categoryId, [], genericFallbackRows(categoryId)),
      warning: "taxonomy_db_error",
    })
  }
}

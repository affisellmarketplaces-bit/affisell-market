import { NextResponse } from "next/server"

import {
  genericFallbackRows,
  resolveCategoryAttributesForForm,
} from "@/lib/category-attribute-resolution"
import { mergeMarketplaceStyleSupplements } from "@/lib/marketplace-style-spec-supplements"

export const dynamic = "force-dynamic"

/** Used when suppliers have not picked a leaf yet — shows full generic + global compliance fields */
const UNCLASSIFIED_STUB_ID = "__aff_universal_specs__"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get("categoryId")?.trim()

  /** No category picked: never return HTTP 400 (client always needs a usable spec canvas). */
  if (!categoryId) {
    const attributes = mergeMarketplaceStyleSupplements(
      UNCLASSIFIED_STUB_ID,
      [],
      genericFallbackRows(UNCLASSIFIED_STUB_ID)
    )
    return NextResponse.json({ attributes, mode: "unclassified" as const })
  }

  try {
    const attributes = await resolveCategoryAttributesForForm(categoryId)
    return NextResponse.json({ attributes, mode: "taxonomy" as const })
  } catch (e) {
    console.error("[api/attributes/by-category]", e)
    return NextResponse.json({
      attributes: mergeMarketplaceStyleSupplements(categoryId, [], genericFallbackRows(categoryId)),
      warning: "taxonomy_db_error",
    })
  }
}

import { NextResponse } from "next/server"

import { categoryAttributesToDto } from "@/lib/category-attribute-api"
import { resolveCategoryAttributesForFormV2 } from "@/lib/category-attribute-catalog"
import { genericFallbackRows } from "@/lib/category-attribute-resolution"
import { mergeMarketplaceStyleSupplements } from "@/lib/marketplace-style-spec-supplements"

export const dynamic = "force-dynamic"

/** Used when suppliers have not picked a leaf yet — shows full generic + global compliance fields */
const UNCLASSIFIED_STUB_ID = "__aff_universal_specs__"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get("categoryId")?.trim()

  /** No category picked: never return HTTP 400 (client always needs a usable spec canvas). */
  if (!categoryId) {
    const rows = mergeMarketplaceStyleSupplements(
      UNCLASSIFIED_STUB_ID,
      [],
      genericFallbackRows(UNCLASSIFIED_STUB_ID)
    )
    return NextResponse.json({
      attributes: categoryAttributesToDto(rows),
      mode: "unclassified" as const,
      schemaVersion: 2 as const,
    })
  }

  try {
    const attributes = await resolveCategoryAttributesForFormV2(categoryId)
    return NextResponse.json({
      attributes,
      mode: "taxonomy" as const,
      schemaVersion: 2 as const,
    })
  } catch (e) {
    console.error("[api/attributes/by-category]", e)
    const fallback = mergeMarketplaceStyleSupplements(categoryId, [], genericFallbackRows(categoryId))
    return NextResponse.json({
      attributes: categoryAttributesToDto(fallback),
      warning: "taxonomy_db_error",
      schemaVersion: 2 as const,
    })
  }
}

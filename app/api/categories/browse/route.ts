import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { buildCategoryBrowse, fetchAllCategoriesForBrowse } from "@/lib/category-browse"

export const dynamic = "force-dynamic"
export const revalidate = 0

/** Full category tree for supplier browse / search (self-referential `Category` model). */
export async function GET() {
  try {
    const rows = await fetchAllCategoriesForBrowse(prisma)
    const { nodes, rootIds, childrenByParent, leafPaths } = buildCategoryBrowse(rows)
    return NextResponse.json({ nodes, rootIds, childrenByParent, leafPaths })
  } catch (e) {
    console.error("[api/categories/browse]", e)
    return NextResponse.json(
      { nodes: {}, rootIds: [], childrenByParent: {}, leafPaths: [] },
      { status: 500 }
    )
  }
}

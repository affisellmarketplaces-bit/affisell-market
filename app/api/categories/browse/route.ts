import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { buildCategoryBrowse, fetchAllCategoriesForBrowse } from "@/lib/category-browse"

export const dynamic = "force-dynamic"
export const revalidate = 0

/** Category tree for supplier browse. `?lite=1` omits leafPaths (use `/api/categories/search` for leaves). */
export async function GET(req: Request) {
  const lite = new URL(req.url).searchParams.get("lite") === "1"
  try {
    const rows = await fetchAllCategoriesForBrowse(prisma)
    const built = buildCategoryBrowse(rows)
    const version = rows.length
    if (lite) {
      return NextResponse.json({
        nodes: built.nodes,
        rootIds: built.rootIds,
        childrenByParent: built.childrenByParent,
        leafPaths: [],
        version,
        lite: true,
      })
    }
    return NextResponse.json({
      nodes: built.nodes,
      rootIds: built.rootIds,
      childrenByParent: built.childrenByParent,
      leafPaths: built.leafPaths,
      version,
    })
  } catch (e) {
    console.error("[api/categories/browse]", e)
    return NextResponse.json(
      { nodes: {}, rootIds: [], childrenByParent: {}, leafPaths: [] },
      { status: 500 }
    )
  }
}

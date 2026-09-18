import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getCategoryDisplayLocalizer } from "@/lib/category-display-locale.server"
import { resolveRequestLocale } from "@/lib/resolve-request-locale"
import { buildCategoryBrowse, fetchAllCategoriesForBrowse } from "@/lib/category-browse"

export const dynamic = "force-dynamic"
export const revalidate = 0

/** Category tree for supplier browse. `?lite=1` omits leafPaths (use `/api/categories/search` for leaves). */
export async function GET(req: Request) {
  const lite = new URL(req.url).searchParams.get("lite") === "1"
  try {
    const locale = await resolveRequestLocale(undefined)
    const display = await getCategoryDisplayLocalizer(prisma, locale)
    const rows = (await fetchAllCategoriesForBrowse(prisma)).map((r) => ({
      ...r,
      name: display.name(r.id, r.name),
    }))
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

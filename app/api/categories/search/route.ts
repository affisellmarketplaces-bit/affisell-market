import { NextResponse } from "next/server"

import type { LeafPath } from "@/lib/category-browse"
import { resolveCategoryPathSegments } from "@/lib/category-path"
import { scoreProductTextAgainstBreadcrumb } from "@/lib/category-title-match"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

const MAX_RESULTS = 40

/**
 * Server-side leaf search (Affisell marketplace catalog). Used by supplier category picker.
 * Optional `title` query param re-ranks results by product-intent relevance.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const titleHint = searchParams.get("title")?.trim() ?? ""
  if (q.length < 2) {
    return NextResponse.json({ results: [] as LeafPath[] })
  }

  try {
    const rows = await prisma.category.findMany({
      where: {
        isLeaf: true,
        OR: [
          { fullPath: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, fullPath: true, name: true },
      orderBy: [{ level: "desc" }, { fullPath: "asc" }],
      take: MAX_RESULTS * 2,
    })

    const results: Array<LeafPath & { relevanceScore?: number }> = []
    for (const row of rows) {
      const path = await resolveCategoryPathSegments(prisma, row.id)
      if (!path.length) continue
      const breadcrumb = row.fullPath || path.map((p) => p.name).join(" > ")
      const relevanceScore = titleHint
        ? scoreProductTextAgainstBreadcrumb(`${titleHint} ${q}`, breadcrumb)
        : scoreProductTextAgainstBreadcrumb(q, breadcrumb)
      results.push({
        leafId: row.id,
        breadcrumb,
        path,
        relevanceScore,
      })
    }

    results.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))

    return NextResponse.json({
      results: results.slice(0, MAX_RESULTS).map(({ relevanceScore: _rs, ...lp }) => lp),
    })
  } catch (e) {
    console.error("[api/categories/search]", e)
    return NextResponse.json({ results: [] as LeafPath[], error: "search_failed" }, { status: 500 })
  }
}

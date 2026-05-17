import { NextResponse } from "next/server"

import type { LeafPath } from "@/lib/category-browse"
import { resolveCategoryPathSegments } from "@/lib/category-path"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

const MAX_RESULTS = 40

/**
 * Server-side leaf search (full Google taxonomy path). Used by supplier category picker.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() ?? ""
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
      take: MAX_RESULTS,
    })

    const results: LeafPath[] = []
    for (const row of rows) {
      const path = await resolveCategoryPathSegments(prisma, row.id)
      if (!path.length) continue
      results.push({
        leafId: row.id,
        breadcrumb: row.fullPath || path.map((p) => p.name).join(" > "),
        path,
      })
    }

    return NextResponse.json({ results })
  } catch (e) {
    console.error("[api/categories/search]", e)
    return NextResponse.json({ results: [] as LeafPath[], error: "search_failed" }, { status: 500 })
  }
}

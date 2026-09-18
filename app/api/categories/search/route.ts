import { NextResponse } from "next/server"

import type { LeafPath } from "@/lib/category-browse"
import { resolveCategoryPathSegmentsMap } from "@/lib/category-path"
import { scoreProductTextAgainstBreadcrumb } from "@/lib/category-title-match"
import { prisma } from "@/lib/prisma"
import { getCategoryDisplayLocalizer } from "@/lib/category-display-locale.server"
import { googleTaxonomyNameMap } from "@/lib/google-taxonomy-locale"
import { resolveRequestLocale } from "@/lib/resolve-request-locale"

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
    const locale = await resolveRequestLocale(undefined)
    const display = await getCategoryDisplayLocalizer(prisma, locale)
    // DB names are French: for other UI languages also match the localized taxonomy names.
    const localizedGoogleIds: number[] = []
    if (locale !== "fr") {
      const needle = q.toLowerCase()
      for (const [googleId, label] of googleTaxonomyNameMap(locale)) {
        if (label.toLowerCase().includes(needle)) localizedGoogleIds.push(googleId)
        if (localizedGoogleIds.length >= 300) break
      }
    }
    const rows = await prisma.category.findMany({
      where: {
        isLeaf: true,
        OR: [
          { fullPath: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          ...(localizedGoogleIds.length ? [{ googleId: { in: localizedGoogleIds } }] : []),
        ],
      },
      select: { id: true, fullPath: true, name: true },
      orderBy: [{ level: "desc" }, { fullPath: "asc" }],
      take: MAX_RESULTS * 2,
    })

    const pathByLeafId = await resolveCategoryPathSegmentsMap(
      prisma,
      rows.map((row) => row.id)
    )
    const results: Array<LeafPath & { relevanceScore?: number }> = []
    for (const row of rows) {
      const path = pathByLeafId.get(row.id) ?? []
      if (!path.length) continue
      const breadcrumb = row.fullPath || path.map((p) => p.name).join(" > ")
      const relevanceScore = titleHint
        ? scoreProductTextAgainstBreadcrumb(`${titleHint} ${q}`, breadcrumb)
        : scoreProductTextAgainstBreadcrumb(q, breadcrumb)
      results.push({
        leafId: row.id,
        breadcrumb: locale === "fr" ? breadcrumb : display.breadcrumb(path),
        path: display.segments(path),
        relevanceScore,
      })
    }

    // Score uses French intent rules; for other UI languages rank the localized leaf name first.
    const leafRank = (r: LeafPath): number => {
      if (locale === "fr") return 0
      const leaf = (r.path[r.path.length - 1]?.name ?? "").toLowerCase()
      const needle = q.toLowerCase()
      return leaf === needle ? 0 : leaf.startsWith(needle) ? 1 : leaf.includes(needle) ? 2 : 3
    }
    results.sort(
      (a, b) =>
        leafRank(a) - leafRank(b) || (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0)
    )

    return NextResponse.json({
      results: results.slice(0, MAX_RESULTS).map(({ relevanceScore: _rs, ...lp }) => lp),
    })
  } catch (e) {
    console.error("[api/categories/search]", e)
    return NextResponse.json({ results: [] as LeafPath[], error: "search_failed" }, { status: 500 })
  }
}

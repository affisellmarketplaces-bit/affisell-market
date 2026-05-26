import { prisma } from "@/lib/prisma"
import {
  extractProductTitleTokens,
} from "@/lib/category-title-match"
import {
  buildListingProductContext,
  scoreListingContextAgainstBreadcrumb,
} from "@/lib/listing-product-signal"

const MIN_TITLE_OVERLAP = 0.35
const MIN_CATALOG_SCORE = 0.42
const MAX_CATALOG_ROWS = 400
const MAX_CATALOG_SUGGESTIONS = 2

export type CatalogCategorySuggestion = {
  categoryId: string
  breadcrumb: string
  score: number
  overlap: number
  sourceProductTitle: string
}

/** Jaccard overlap on meaningful title tokens (FR plurals handled upstream). */
export function titleTokenOverlap(a: string, b: string): number {
  const ta = new Set(extractProductTitleTokens(a))
  const tb = new Set(extractProductTitleTokens(b))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) {
    if (tb.has(t)) inter++
  }
  const union = ta.size + tb.size - inter
  return union > 0 ? inter / union : 0
}

function scoreCatalogMatch(
  newTitle: string,
  newDescription: string,
  existingTitle: string,
  breadcrumb: string
): { score: number; overlap: number } {
  const ctx = buildListingProductContext(newTitle, { description: newDescription })
  const overlap = titleTokenOverlap(ctx.classificationFocus, existingTitle)
  const textScore = scoreListingContextAgainstBreadcrumb(ctx, breadcrumb)
  const score = overlap * 0.62 + textScore * 0.38
  return { score, overlap }
}

/**
 * Suggest categories from products already categorized on the marketplace
 * (any supplier). Scales without manual rules per SKU.
 */
export async function suggestCategoriesFromCatalog(params: {
  title: string
  description?: string
  supplierId?: string
}): Promise<CatalogCategorySuggestion[]> {
  const title = params.title.trim()
  if (title.length < 4) return []

  const tokens = extractProductTitleTokens(title)
  if (tokens.length === 0) return []

  const rows = await prisma.product.findMany({
    where: {
      categoryId: { not: null },
      active: true,
      isDraft: false,
      ...(params.supplierId ? { supplierId: { not: params.supplierId } } : {}),
      OR: tokens.slice(0, 6).map((token) => ({
        name: { contains: token, mode: "insensitive" as const },
      })),
    },
    select: {
      name: true,
      categoryId: true,
      category: { select: { fullPath: true, name: true } },
    },
    take: MAX_CATALOG_ROWS,
    orderBy: { updatedAt: "desc" },
  })

  const byCategory = new Map<
    string,
    {
      breadcrumb: string
      bestScore: number
      bestOverlap: number
      sourceProductTitle: string
    }
  >()

  for (const row of rows) {
    if (!row.categoryId || !row.category) continue
    const breadcrumb =
      row.category.fullPath.trim() || row.category.name.trim()
    if (!breadcrumb) continue
    const { score, overlap } = scoreCatalogMatch(
      title,
      params.description ?? "",
      row.name,
      breadcrumb
    )
    if (overlap < MIN_TITLE_OVERLAP || score < MIN_CATALOG_SCORE) continue

    const prev = byCategory.get(row.categoryId)
    if (!prev || score > prev.bestScore) {
      byCategory.set(row.categoryId, {
        breadcrumb,
        bestScore: score,
        bestOverlap: overlap,
        sourceProductTitle: row.name,
      })
    }
  }

  return [...byCategory.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      breadcrumb: v.breadcrumb,
      score: v.bestScore,
      overlap: v.bestOverlap,
      sourceProductTitle: v.sourceProductTitle,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CATALOG_SUGGESTIONS)
}

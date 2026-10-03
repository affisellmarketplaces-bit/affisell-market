import "server-only"

import { prisma } from "@/lib/prisma"
import {
  extractCorrections,
  summarizeCategoryEngineAccuracy,
  type CategoryEngineAccuracy,
  type SuggestionObservation,
} from "@/lib/category-engine-accuracy-shared"

const DAY_MS = 24 * 60 * 60 * 1000
/** Rows read per report — a rolling sample, bounded so the admin call stays inside the function time cap. */
const MAX_LOG_ROWS = 5000

export type CategoryEngineReport = CategoryEngineAccuracy & {
  windowDays: number
  /** Confusions with human-readable category names. */
  topConfusionsNamed: { from: string; to: string; fromLeafId: string; toLeafId: string; count: number }[]
  /** Labelled examples (engine said `from`, a human chose `to`) — the training signal. */
  corrections: { productId: string; title: string | null; from: string; to: string; confidence: number }[]
}

/**
 * Read-only: compares the engine's latest suggestion per product with the category the product has now.
 */
export async function loadCategoryEngineReport(
  options: { windowDays?: number; correctionsLimit?: number; now?: Date } = {}
): Promise<CategoryEngineReport> {
  const windowDays = Math.min(365, Math.max(1, Math.round(options.windowDays ?? 90)))
  const since = new Date((options.now ?? new Date()).getTime() - windowDays * DAY_MS)

  const logs = await prisma.categorySuggestionLog.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: MAX_LOG_ROWS,
    select: { productId: true, leafId: true, confidence: true, applied: true, createdAt: true },
  })

  const productIds = [...new Set(logs.map((l) => l.productId))]
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, categoryId: true },
      })
    : []
  const byId = new Map(products.map((p) => [p.id, p]))

  const observations: SuggestionObservation[] = logs.flatMap((l) => {
    const product = byId.get(l.productId)
    // A product that no longer exists is not evidence either way.
    return product
      ? [
          {
            productId: l.productId,
            suggestedLeafId: l.leafId,
            confidence: l.confidence,
            applied: l.applied,
            createdAt: l.createdAt,
            currentLeafId: product.categoryId,
          },
        ]
      : []
  })

  const summary = summarizeCategoryEngineAccuracy(observations)
  const corrections = extractCorrections(observations).slice(0, options.correctionsLimit ?? 100)

  const categoryIds = [
    ...new Set([
      ...summary.topConfusions.flatMap((c) => [c.fromLeafId, c.toLeafId]),
      ...corrections.flatMap((c) => [c.fromLeafId, c.toLeafId]),
    ]),
  ]
  const categories = categoryIds.length
    ? await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
    : []
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? id

  return {
    ...summary,
    windowDays,
    topConfusionsNamed: summary.topConfusions.map((c) => ({
      from: nameOf(c.fromLeafId),
      to: nameOf(c.toLeafId),
      fromLeafId: c.fromLeafId,
      toLeafId: c.toLeafId,
      count: c.count,
    })),
    corrections: corrections.map((c) => ({
      productId: c.productId,
      title: byId.get(c.productId)?.name ?? null,
      from: nameOf(c.fromLeafId),
      to: nameOf(c.toLeafId),
      confidence: c.confidence,
    })),
  }
}

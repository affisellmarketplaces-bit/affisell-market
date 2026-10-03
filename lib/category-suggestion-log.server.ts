import "server-only"

import { prisma } from "@/lib/prisma"

/**
 * Persist what the category engine proposed for a product (catalogue-learning loop). Never throws and never blocks the
 * caller's outcome: the log is an observation, losing a row is acceptable, breaking categorisation is not.
 */
export async function recordCategorySuggestion(args: {
  productId: string
  leafId: string
  confidence: number
  applied: boolean
  needsReview?: boolean
}): Promise<void> {
  try {
    if (!args.productId || !args.leafId || !Number.isFinite(args.confidence)) return
    await prisma.categorySuggestionLog.create({
      data: {
        productId: args.productId,
        leafId: args.leafId,
        confidence: args.confidence,
        applied: args.applied,
        needsReview: args.needsReview === true,
      },
    })
  } catch (error) {
    console.error("[category-suggestion-log]", error instanceof Error ? error.message : String(error))
  }
}

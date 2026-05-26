import { classifyListingProductForCategories } from "@/lib/ai/listing-product-classifier"
import {
  buildCategoryBrowse,
  fetchAllCategoriesForBrowse,
  leafPathsForAiCatalog,
  suggestLeafCategoriesFromProductText,
  type LeafPath,
} from "@/lib/category-browse"
import { suggestCategoriesFromCatalog } from "@/lib/category-marketplace-learning"
import {
  buildListingProductContext,
  listingProductInsight,
  scoreListingContextAgainstBreadcrumb,
  type ListingProductInsight,
} from "@/lib/listing-product-signal"
import {
  findWearableCategoryAlternatives,
  isCategorySuggestionViable,
  type CategoryAlternativeSuggestion,
} from "@/lib/category-title-match"
import type { PrismaClient } from "@prisma/client"

export type ListingCategorySuggestion = LeafPath & {
  confidence?: number
  /** Where this pick came from (for UI hints). */
  suggestionSource?: "catalog" | "ai" | "keyword"
  /** AI rationale tied to product name (when available). */
  aiReason?: string
}

export type SuggestListingCategoriesResult = {
  suggestions: ListingCategorySuggestion[]
  /** e.g. Bijoux > Montres when primary is activity monitor */
  alternatives: CategoryAlternativeSuggestion[]
  recommendedLeafId: string | null
  source: "none" | "empty" | "keyword" | "ai" | "hybrid" | "catalog"
  /** What the engine focused on (title-first). */
  productInsight: ListingProductInsight | null
}

const MIN_KEYWORD_SCORE_FOR_MERGE = 7

export const LISTING_CATEGORY_SUGGESTION_LIMIT = 5

function mergeAiAndKeyword(
  ctx: ReturnType<typeof buildListingProductContext>,
  aiPicks: LeafPath[],
  keywordPicks: LeafPath[],
  limit: number
): LeafPath[] {
  const viabilityText = `${ctx.classificationFocus} ${ctx.supplierDetails}`.trim()
  const seen = new Set<string>()
  const out: LeafPath[] = []

  const pushUnique = (lp: LeafPath) => {
    if (seen.has(lp.leafId)) return
    seen.add(lp.leafId)
    out.push(lp)
  }

  for (const lp of aiPicks) {
    if (out.length >= limit) break
    pushUnique(lp)
  }
  for (const lp of keywordPicks) {
    if (out.length >= limit) break
    if (isCategorySuggestionViable(viabilityText, lp.breadcrumb)) pushUnique(lp)
  }

  if (out.length >= limit) return out.slice(0, limit)

  const ranked = [...aiPicks, ...keywordPicks]
    .filter((lp) => !seen.has(lp.leafId))
    .map((lp) => ({ lp, s: scoreListingContextAgainstBreadcrumb(ctx, lp.breadcrumb) }))
    .filter(({ s }) => s >= MIN_KEYWORD_SCORE_FOR_MERGE)
    .sort((a, b) => b.s - a.s)

  for (const { lp } of ranked) {
    if (out.length >= limit) break
    pushUnique(lp)
  }

  return out.slice(0, limit)
}

/**
 * Category suggestions for supplier listing — same AI engine as background auto-categorize,
 * plus keyword scoring guardrails. No manual rule per product type required.
 */
export async function suggestListingCategories(
  title: string,
  description: string,
  client: PrismaClient,
  options?: { imageUrl?: string | null; supplierId?: string }
): Promise<SuggestListingCategoriesResult> {
  const t = title.trim()
  const d = description.trim()
  let ctx = buildListingProductContext(t, d)
  const viabilityText = `${ctx.classificationFocus} ${ctx.supplierDetails}`.trim()
  const insight = listingProductInsight(ctx)

  if (t.length < 2) {
    return {
      suggestions: [],
      alternatives: [],
      recommendedLeafId: null,
      source: "none",
      productInsight: null,
    }
  }

  const rows = await fetchAllCategoriesForBrowse(client)
  const { leafPaths } = buildCategoryBrowse(rows)

  if (leafPaths.length === 0) {
    return {
      suggestions: [],
      alternatives: [],
      recommendedLeafId: null,
      source: "empty",
      productInsight: insight,
    }
  }

  const keywordFallback = suggestLeafCategoriesFromProductText(
    ctx.classificationFocus,
    ctx.supplierDetails,
    leafPaths,
    LISTING_CATEGORY_SUGGESTION_LIMIT + 2
  )

  const catalogHits = await suggestCategoriesFromCatalog({
    title: t,
    description: d,
    supplierId: options?.supplierId,
  })
  const catalogPicks: LeafPath[] = []
  for (const hit of catalogHits) {
    const lp = leafPaths.find((p) => p.leafId === hit.categoryId)
    if (lp && isCategorySuggestionViable(viabilityText, lp.breadcrumb)) catalogPicks.push(lp)
  }

  const catalogLeaves = leafPathsForAiCatalog(leafPaths, ctx)
  const aiBreadcrumbs = catalogLeaves.map((lp) => lp.breadcrumb)

  let aiPicks: LeafPath[] = []
  let aiConfidences = new Map<string, number>()

  let aiReasons = new Map<string, string>()

  if (process.env.GROQ_API_KEY?.trim()) {
    const { identity, suggestions: aiRows } = await classifyListingProductForCategories(ctx, {
      allowedBreadcrumbs: aiBreadcrumbs,
      leafPaths: catalogLeaves.length > 0 ? catalogLeaves : leafPaths,
      imageUrl: options?.imageUrl,
    })

    if (identity?.productNameFr) {
      ctx.productName = identity.productNameFr
      ctx.classificationFocus = identity.productNameFr
    }

    for (const row of aiRows) {
      if (!row.leafId) continue
      const lp = leafPaths.find((p) => p.leafId === row.leafId)
      if (!lp || !isCategorySuggestionViable(viabilityText, lp.breadcrumb)) continue
      aiPicks.push(lp)
      aiConfidences.set(lp.leafId, row.confidence)
      if (row.reason) aiReasons.set(lp.leafId, row.reason)
    }
  }

  const viableKeywords = keywordFallback.filter((lp) =>
    isCategorySuggestionViable(viabilityText, lp.breadcrumb)
  )
  const keywordPicks = viableKeywords.length > 0 ? viableKeywords : keywordFallback

  const merged = mergeAiAndKeyword(ctx, aiPicks, keywordPicks, LISTING_CATEGORY_SUGGESTION_LIMIT)

  const catalogIds = new Set(catalogPicks.map((lp) => lp.leafId))
  const finalMerged: LeafPath[] = []
  const seenMerged = new Set<string>()
  for (const lp of [...catalogPicks, ...merged]) {
    if (finalMerged.length >= LISTING_CATEGORY_SUGGESTION_LIMIT) break
    if (seenMerged.has(lp.leafId)) continue
    seenMerged.add(lp.leafId)
    finalMerged.push(lp)
  }

  const suggestions: ListingCategorySuggestion[] = finalMerged.map((lp) => {
    const fromCatalog = catalogIds.has(lp.leafId)
    const hit = catalogHits.find((h) => h.categoryId === lp.leafId)
    const aiConf = aiConfidences.get(lp.leafId)
    const score = scoreListingContextAgainstBreadcrumb(ctx, lp.breadcrumb)
    return {
      ...lp,
      confidence: fromCatalog
        ? Math.min(0.92, 0.62 + (hit?.score ?? 0) * 0.35)
        : (aiConf ?? Math.min(0.72, 0.35 + score / 40)),
      suggestionSource: fromCatalog ? "catalog" : aiConf != null ? "ai" : "keyword",
      aiReason: aiReasons.get(lp.leafId),
    }
  })

  const topScore = finalMerged[0]
    ? scoreListingContextAgainstBreadcrumb(ctx, finalMerged[0].breadcrumb)
    : 0

  const source: SuggestListingCategoriesResult["source"] =
    catalogPicks.length > 0 && finalMerged[0] && catalogIds.has(finalMerged[0].leafId)
      ? "catalog"
      : aiPicks.length > 0 && finalMerged.some((lp) => aiPicks.some((a) => a.leafId === lp.leafId))
        ? keywordPicks.some(
            (lp) =>
              finalMerged.some(
                (m) => m.leafId === lp.leafId && !aiPicks.some((a) => a.leafId === lp.leafId)
              )
          )
          ? "hybrid"
          : "ai"
        : "keyword"

  const alternatives = findWearableCategoryAlternatives(t, d, leafPaths, suggestions)

  return {
    suggestions,
    alternatives,
    recommendedLeafId:
      suggestions[0] &&
      (catalogIds.has(suggestions[0].leafId) || topScore >= MIN_KEYWORD_SCORE_FOR_MERGE)
        ? suggestions[0].leafId
        : null,
    source,
    productInsight: listingProductInsight(ctx) ?? insight,
  }
}

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
  categoryOnlyMatchesDescriptionNoise,
  listingProductInsight,
  listingViabilityText,
  scoreListingContextAgainstBreadcrumb,
  type ListingProductInsight,
} from "@/lib/listing-product-signal"
import {
  findWearableCategoryAlternatives,
  isCategorySuggestionViable,
  type CategoryAlternativeSuggestion,
} from "@/lib/category-title-match"
import type { PrismaClient } from "@prisma/client"

import {
  hasListingClassificationSignal,
  shouldAutoApplyCategorySuggestion,
} from "@/lib/supplier-auto-category-policy"

export type ListingCategorySuggestion = LeafPath & {
  confidence?: number
  suggestionSource?: "catalog" | "ai" | "keyword"
  aiReason?: string
}

export type SuggestListingCategoriesResult = {
  suggestions: ListingCategorySuggestion[]
  alternatives: CategoryAlternativeSuggestion[]
  recommendedLeafId: string | null
  /** True when recommendedLeafId is strong enough for silent auto-apply in the form. */
  autoApplyRecommended: boolean
  source: "none" | "empty" | "keyword" | "ai" | "hybrid" | "catalog"
  productInsight: ListingProductInsight | null
  visionUsed: boolean
  /** Filled from vision when supplier title is empty/short. */
  suggestedProductName: string | null
}

const MIN_KEYWORD_SCORE_FOR_MERGE = 7

export const LISTING_CATEGORY_SUGGESTION_LIMIT = 5

function isViableListingCategory(
  ctx: ReturnType<typeof buildListingProductContext>,
  breadcrumb: string
): boolean {
  if (categoryOnlyMatchesDescriptionNoise(ctx, breadcrumb)) return false
  return isCategorySuggestionViable(listingViabilityText(ctx), breadcrumb)
}

function mergeAiAndKeyword(
  ctx: ReturnType<typeof buildListingProductContext>,
  aiPicks: LeafPath[],
  keywordPicks: LeafPath[],
  limit: number
): LeafPath[] {
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
    if (isViableListingCategory(ctx, lp.breadcrumb)) pushUnique(lp)
  }

  if (out.length >= limit) return out.slice(0, limit)

  const ranked = [...aiPicks, ...keywordPicks]
    .filter((lp) => !seen.has(lp.leafId))
    .map((lp) => ({ lp, s: scoreListingContextAgainstBreadcrumb(ctx, lp.breadcrumb) }))
    .filter(({ s, lp }) => s >= MIN_KEYWORD_SCORE_FOR_MERGE && isViableListingCategory(ctx, lp.breadcrumb))
    .sort((a, b) => b.s - a.s)

  for (const { lp } of ranked) {
    if (out.length >= limit) break
    pushUnique(lp)
  }

  return out.slice(0, limit)
}

export async function suggestListingCategories(
  title: string,
  description: string,
  client: PrismaClient,
  options?: {
    imageUrl?: string | null
    supplierId?: string
    bullets?: string[]
  }
): Promise<SuggestListingCategoriesResult> {
  const t = title.trim()
  const imageUrl = options?.imageUrl?.trim() || null
  const visionUsed = Boolean(imageUrl)

  if (!hasListingClassificationSignal(t, imageUrl)) {
    return {
      suggestions: [],
      alternatives: [],
      recommendedLeafId: null,
      autoApplyRecommended: false,
      source: "none",
      productInsight: null,
      visionUsed,
      suggestedProductName: null,
    }
  }

  const titleForCtx = t.length >= 2 ? t : visionUsed ? "Produit" : t
  let ctx = buildListingProductContext(titleForCtx, {
    description: description.trim(),
    bullets: options?.bullets,
  })
  const insight = listingProductInsight(ctx)

  const rows = await fetchAllCategoriesForBrowse(client)
  const { leafPaths } = buildCategoryBrowse(rows)

  if (leafPaths.length === 0) {
    return {
      suggestions: [],
      alternatives: [],
      recommendedLeafId: null,
      autoApplyRecommended: false,
      source: "empty",
      productInsight: insight,
      visionUsed,
      suggestedProductName: null,
    }
  }

  const keywordFallback = suggestLeafCategoriesFromProductText(
    ctx.classificationFocus,
    "",
    leafPaths,
    LISTING_CATEGORY_SUGGESTION_LIMIT + 2
  )

  const catalogHits = await suggestCategoriesFromCatalog({
    title: t,
    description: ctx.supplierHints,
    supplierId: options?.supplierId,
  })
  const catalogPicks: LeafPath[] = []
  for (const hit of catalogHits) {
    const lp = leafPaths.find((p) => p.leafId === hit.categoryId)
    if (lp && isViableListingCategory(ctx, lp.breadcrumb)) catalogPicks.push(lp)
  }

  const catalogLeaves = leafPathsForAiCatalog(leafPaths, ctx)
  const aiBreadcrumbs = catalogLeaves.map((lp) => lp.breadcrumb)

  let aiPicks: LeafPath[] = []
  let aiConfidences = new Map<string, number>()
  let aiReasons = new Map<string, string>()
  let suggestedProductName: string | null = null

  if (process.env.GROQ_API_KEY?.trim()) {
    const { identity, suggestions: aiRows } = await classifyListingProductForCategories(ctx, {
      allowedBreadcrumbs: aiBreadcrumbs,
      leafPaths: catalogLeaves.length > 0 ? catalogLeaves : leafPaths,
      imageUrl,
    })

    if (identity?.productNameFr) {
      ctx = { ...ctx, productName: identity.productNameFr, classificationFocus: identity.productNameFr }
      if (t.length < 5 && identity.productNameFr.length >= 3) {
        suggestedProductName = identity.productNameFr
      }
    }

    for (const row of aiRows) {
      if (!row.leafId) continue
      const lp = leafPaths.find((p) => p.leafId === row.leafId)
      if (!lp || !isViableListingCategory(ctx, lp.breadcrumb)) continue
      aiPicks.push(lp)
      aiConfidences.set(lp.leafId, row.confidence)
      if (row.reason) aiReasons.set(lp.leafId, row.reason)
    }
  }

  const viableKeywords = keywordFallback.filter((lp) => isViableListingCategory(ctx, lp.breadcrumb))
  const keywordPicks = viableKeywords.length > 0 ? viableKeywords : keywordFallback

  const merged = mergeAiAndKeyword(ctx, aiPicks, keywordPicks, LISTING_CATEGORY_SUGGESTION_LIMIT)

  const catalogIds = new Set(catalogPicks.map((lp) => lp.leafId))
  const finalMerged: LeafPath[] = []
  const seenMerged = new Set<string>()
  for (const lp of [...catalogPicks, ...merged]) {
    if (finalMerged.length >= LISTING_CATEGORY_SUGGESTION_LIMIT) break
    if (seenMerged.has(lp.leafId)) continue
    if (!isViableListingCategory(ctx, lp.breadcrumb)) continue
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

  const alternatives = findWearableCategoryAlternatives(t, ctx.supplierHints, leafPaths, suggestions)

  let finalSuggestions = suggestions
  let finalTopScore = topScore
  let finalSource = source

  if (finalSuggestions.length === 0) {
    const rescue = suggestLeafCategoriesFromProductText(
      t,
      ctx.supplierHints,
      leafPaths,
      LISTING_CATEGORY_SUGGESTION_LIMIT
    )
    finalSuggestions = rescue.map((lp) => {
      const score = scoreListingContextAgainstBreadcrumb(ctx, lp.breadcrumb)
      return {
        ...lp,
        confidence: Math.min(0.72, 0.35 + score / 40),
        suggestionSource: "keyword" as const,
      }
    })
    finalTopScore = rescue[0] ? scoreListingContextAgainstBreadcrumb(ctx, rescue[0].breadcrumb) : 0
    finalSource = finalSuggestions.length > 0 ? "keyword" : source
  }

  const top = finalSuggestions[0] ?? null
  const autoApplyRecommended =
    top != null &&
    shouldAutoApplyCategorySuggestion({
      confidence: top.confidence ?? 0,
      suggestionSource: top.suggestionSource,
      hasImage: visionUsed,
    })

  const recommendedLeafId =
    top &&
    (autoApplyRecommended ||
      catalogIds.has(top.leafId) ||
      finalTopScore >= MIN_KEYWORD_SCORE_FOR_MERGE ||
      (finalSource === "keyword" && finalTopScore >= 5))
      ? top.leafId
      : null

  const baseInsight = listingProductInsight(ctx) ?? insight
  const productInsightOut: ListingProductInsight | null = baseInsight
    ? {
        ...baseInsight,
        focusLabel: visionUsed
          ? `Scan photo + titre → ${baseInsight.productName}`
          : baseInsight.focusLabel,
      }
    : null

  return {
    suggestions: finalSuggestions,
    alternatives,
    recommendedLeafId,
    autoApplyRecommended,
    source: finalSource,
    productInsight: productInsightOut,
    visionUsed,
    suggestedProductName,
  }
}

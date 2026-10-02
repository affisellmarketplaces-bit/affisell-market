import {
  buildCategoryBrowse,
  fetchAllCategoriesForBrowse,
  suggestLeafCategoriesFromProductText,
  type LeafPath,
} from "@/lib/category-browse"
import { suggestCategoriesFromCatalog } from "@/lib/category-marketplace-learning"
import {
  buildListingProductContext,
  breadcrumbConflictsWithIdentity,
  listingProductInsight,
  listingViabilityText,
  type ListingProductInsight,
} from "@/lib/listing-product-signal"
import { expandEnglishProductTerms, filterByKeywordEvidence } from "@/lib/category-keyword-evidence"
import {
  findWearableCategoryAlternatives,
  type CategoryAlternativeSuggestion,
} from "@/lib/category-title-match"
import type { PrismaClient } from "@prisma/client"

import { classifyWithTaxonomyAi } from "@/lib/taxonomy-classify.server"

import {
  hasListingClassificationSignal,
  isDurableListingImageUrl,
  shouldAutoApplyCategorySuggestion,
} from "@/lib/supplier-auto-category-policy"
import { tMessage } from "@/lib/i18n-pick-message"
import type { AppLocale } from "@/lib/i18n-locale"

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
  /** What the classifier understood the item to be — lets the UI warn when the photo and the title disagree. */
  identity?: { name: string; photoShows: string; photoTitleConflict: boolean; confidence: number } | null
}

export const LISTING_CATEGORY_SUGGESTION_LIMIT = 5

/** An AI pick below this is a guess: showing nothing beats showing a category the model itself doubts. */
export const MIN_DISPLAY_CONFIDENCE = 0.4

/** Keyword-only suggestions are heuristics, never "recommended": their confidence stays honestly low. */
const KEYWORD_CONFIDENCE = 0.4

/**
 * Category contradicts what the item is (watch ≠ jewellery…). Deliberately NOT a lexical-overlap test: those score an
 * English title against French labels and reject the correct category. Overlap is enforced separately, strictly,
 * by `categoryHasSpecificEvidence` for keyword picks.
 */
function isConflictFree(ctx: ReturnType<typeof buildListingProductContext>, breadcrumb: string): boolean {
  if (breadcrumbConflictsWithIdentity(ctx, breadcrumb)) return false

  /** "Montre connectée" must not land in bijouterie when wearable intent wins. */
  const focus = listingViabilityText(ctx)
  if (
    /\bmontre\s*connect|smart\s*watch|bracelet\s*connect|smart\s*band/i.test(focus) &&
    /bijoux\s*>\s*montres|^vetements et accessoires\s*>\s*bijoux\s*>\s*montres$/i.test(
      breadcrumb
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    )
  ) {
    return false
  }
  return true
}

export async function suggestListingCategories(
  title: string,
  description: string,
  client: PrismaClient,
  options?: {
    imageUrl?: string | null
    supplierId?: string
    bullets?: string[]
    locale?: AppLocale
  }
): Promise<SuggestListingCategoriesResult> {
  const t = title.trim()
  const rawImage = options?.imageUrl?.trim() || null
  const imageUrl = isDurableListingImageUrl(rawImage) ? rawImage : null
  const visionUsed = Boolean(imageUrl)
  const locale: AppLocale = options?.locale ?? "fr"

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

  const titleForCtx =
    t.length >= 2
      ? t
      : visionUsed
        ? tMessage(locale, "supplier.expressTaxonomy.genericProductFallback")
        : t
  const ctx = buildListingProductContext(titleForCtx, {
    description: description.trim(),
    bullets: options?.bullets,
  })
  const insight = listingProductInsight(ctx, locale)

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

  // ── Primary engine: Claude — understand the item (photo first), then descend the taxonomy. Legacy engine below
  // stays as the fallback when the key is missing, the call fails, or nothing usable comes back.
  const smart = await classifyWithTaxonomyAi({
    title: t,
    description: description.trim(),
    imageUrl,
    supplierId: options?.supplierId,
    browse: buildCategoryBrowse(rows),
    leafPaths,
  })
  if (smart && smart.picks.length > 0) {
    // Generic product name in the supplier's language when we have it (French / English), English otherwise.
    const identityName =
      (locale === "fr" ? smart.identity.nameFr : smart.identity.nameEn) || smart.identity.nameFr || smart.identity.nameEn
    const suggestions: ListingCategorySuggestion[] = smart.picks
      .filter((p) => p.confidence >= MIN_DISPLAY_CONFIDENCE)
      .slice(0, LISTING_CATEGORY_SUGGESTION_LIMIT)
      .map((p) => ({
        leafId: p.leafId,
        breadcrumb: p.breadcrumb,
        path: p.path,
        confidence: p.confidence,
        suggestionSource: "ai" as const,
        aiReason: p.reason || undefined,
      }))
    const top = suggestions[0]
    // Conflicting photo/title = do not silently auto-apply: the supplier must confirm.
    const autoApplyRecommended =
      top != null &&
      !smart.identity.photoTitleConflict &&
      shouldAutoApplyCategorySuggestion({ confidence: top.confidence ?? 0, suggestionSource: "ai", hasImage: visionUsed })
    console.log("[suggest-listing]", {
      engine: smart.engine === "anthropic" ? "claude-taxonomy" : "groq-taxonomy",
      titleLen: t.length,
      visionUsed,
      picks: suggestions.length,
      topConfidence: top?.confidence ?? null,
      conflict: smart.identity.photoTitleConflict,
    })
    const base = listingProductInsight({ ...ctx, productName: identityName || ctx.productName }, locale)
    return {
      suggestions,
      alternatives: [],
      recommendedLeafId: top && (top.confidence ?? 0) >= 0.6 ? top.leafId : null,
      autoApplyRecommended,
      // The AI understood the item but is not sure enough: say so (empty list) instead of falling to a dumber engine.
      source: top ? "ai" : "none",
      productInsight: base,
      visionUsed,
      suggestedProductName: t.length < 5 && identityName.length >= 3 ? identityName : null,
      identity: {
        name: identityName,
        photoShows: smart.identity.photoShows,
        photoTitleConflict: smart.identity.photoTitleConflict,
        confidence: smart.identity.confidence,
      },
    }
  }

  // ── Last resort: no AI engine answered (Claude and Groq both unavailable). Everything below must be defensible,
  // so an unverifiable guess is dropped, never shown:
  //  • catalogue learning — how the marketplace actually categorised similar products (real data);
  //  • keyword matches, kept only with strict evidence (a specific title word names the leaf or its parent).
  const searchText = expandEnglishProductTerms(ctx.title)

  const catalogHits = await suggestCategoriesFromCatalog({
    title: t,
    description: ctx.supplierHints,
    supplierId: options?.supplierId,
  })
  const catalogSuggestions: ListingCategorySuggestion[] = []
  for (const hit of catalogHits) {
    const lp = leafPaths.find((p) => p.leafId === hit.categoryId)
    if (!lp || !isConflictFree(ctx, lp.breadcrumb)) continue
    catalogSuggestions.push({
      ...lp,
      confidence: Math.min(0.8, 0.55 + hit.score * 0.3),
      suggestionSource: "catalog",
    })
  }

  const keywordSuggestions: ListingCategorySuggestion[] = filterByKeywordEvidence(
    searchText,
    suggestLeafCategoriesFromProductText(searchText, "", leafPaths, LISTING_CATEGORY_SUGGESTION_LIMIT + 4)
  )
    .filter((lp) => isConflictFree(ctx, lp.breadcrumb))
    .map((lp) => ({ ...lp, confidence: KEYWORD_CONFIDENCE, suggestionSource: "keyword" as const }))

  const seen = new Set<string>()
  const finalSuggestions: ListingCategorySuggestion[] = []
  for (const sug of [...catalogSuggestions, ...keywordSuggestions]) {
    if (finalSuggestions.length >= LISTING_CATEGORY_SUGGESTION_LIMIT) break
    if (seen.has(sug.leafId)) continue
    seen.add(sug.leafId)
    finalSuggestions.push(sug)
  }

  const alternatives =
    finalSuggestions.length > 0 ? findWearableCategoryAlternatives(t, ctx.supplierHints, leafPaths, finalSuggestions) : []

  const top = finalSuggestions[0] ?? null
  const finalSource: SuggestListingCategoriesResult["source"] = !top
    ? "none"
    : top.suggestionSource === "catalog"
      ? "catalog"
      : "keyword"

  console.log("[suggest-listing]", {
    engine: "fallback",
    titleLen: t.length,
    visionUsed,
    source: finalSource,
    catalog: catalogSuggestions.length,
    keyword: keywordSuggestions.length,
    topLeaf: top?.leafId ?? null,
  })

  // Only data-backed (catalogue) answers may be highlighted or proposed for confirmation; a keyword heuristic never is.
  const recommendedLeafId = top?.suggestionSource === "catalog" ? top.leafId : null
  const autoApplyRecommended =
    top != null &&
    top.suggestionSource === "catalog" &&
    shouldAutoApplyCategorySuggestion({
      confidence: top.confidence ?? 0,
      suggestionSource: "catalog",
      hasImage: visionUsed,
    })

  const baseInsight = listingProductInsight(ctx, locale) ?? insight
  const productInsightOut: ListingProductInsight | null = baseInsight
    ? {
        ...baseInsight,
        focusLabel: visionUsed
          ? tMessage(locale, "supplier.expressTaxonomy.insightVisionScan").replace("{productName}", baseInsight.productName)
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
    suggestedProductName: null,
  }
}

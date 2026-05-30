/** Minimum confidence before we ask the supplier to confirm an IA category pick. */
export const CONFIRM_AI_CONFIDENCE = 0.8
export const CONFIRM_AI_WITH_IMAGE_CONFIDENCE = 0.74
export const CONFIRM_CATALOG_CONFIDENCE = 0.62

export function minConfidenceForCategoryConfirmation(opts: {
  hasImage: boolean
  suggestionSource?: "catalog" | "ai" | "keyword"
}): number {
  if (opts.suggestionSource === "catalog") return CONFIRM_CATALOG_CONFIDENCE
  if (opts.hasImage) return CONFIRM_AI_WITH_IMAGE_CONFIDENCE
  return CONFIRM_AI_CONFIDENCE
}

/** True when the IA pick is strong enough to show a confirm / dismiss prompt. */
export function shouldSuggestCategoryConfirmation(opts: {
  confidence: number
  suggestionSource?: "catalog" | "ai" | "keyword"
  hasImage: boolean
}): boolean {
  if (opts.suggestionSource === "keyword" && !opts.hasImage) return false
  return opts.confidence >= minConfidenceForCategoryConfirmation(opts)
}

/** @deprecated Use shouldSuggestCategoryConfirmation — kept for API field naming. */
export const shouldAutoApplyCategorySuggestion = shouldSuggestCategoryConfirmation

/** Trigger listing suggest API when we have enough signal. */
export function hasListingClassificationSignal(title: string, imageUrl?: string | null): boolean {
  const t = title.trim()
  const img = imageUrl?.trim()
  if (img && img.length > 8) return true
  return t.length >= 3
}

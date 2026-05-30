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

export const LISTING_CLASSIFY_MIN_TITLE_LEN = 3
export const LISTING_CLASSIFY_MIN_IMAGE_URL_LEN = 8

/** Trigger listing suggest API only when title and main photo are both present. */
export function hasListingClassificationSignal(title: string, imageUrl?: string | null): boolean {
  const t = title.trim()
  const img = imageUrl?.trim() ?? ""
  return t.length >= LISTING_CLASSIFY_MIN_TITLE_LEN && img.length > LISTING_CLASSIFY_MIN_IMAGE_URL_LEN
}

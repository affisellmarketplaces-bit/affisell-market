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
export const LISTING_CLASSIFY_MIN_TITLE_ONLY_LEN = 8
export const LISTING_CLASSIFY_MIN_IMAGE_URL_LEN = 8

/** Durable CDN/https image — not an in-browser blob preview. */
export function isDurableListingImageUrl(imageUrl?: string | null): boolean {
  const img = imageUrl?.trim() ?? ""
  return img.length > LISTING_CLASSIFY_MIN_IMAGE_URL_LEN && !img.startsWith("blob:")
}

/** Trigger listing suggest API when title + durable photo, or descriptive title-only (keyword path). */
export function hasListingClassificationSignal(title: string, imageUrl?: string | null): boolean {
  const t = title.trim()
  if (t.length < LISTING_CLASSIFY_MIN_TITLE_LEN) return false
  if (isDurableListingImageUrl(imageUrl)) return true
  return t.length >= LISTING_CLASSIFY_MIN_TITLE_ONLY_LEN
}

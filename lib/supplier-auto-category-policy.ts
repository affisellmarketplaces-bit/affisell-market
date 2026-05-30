/** Auto-apply taxonomy on supplier add-product when confidence is high enough. */
export const AUTO_APPLY_AI_CONFIDENCE = 0.8
export const AUTO_APPLY_AI_WITH_IMAGE_CONFIDENCE = 0.74
export const AUTO_APPLY_CATALOG_CONFIDENCE = 0.62

export function minConfidenceForAutoApply(opts: {
  hasImage: boolean
  suggestionSource?: "catalog" | "ai" | "keyword"
}): number {
  if (opts.suggestionSource === "catalog") return AUTO_APPLY_CATALOG_CONFIDENCE
  if (opts.hasImage) return AUTO_APPLY_AI_WITH_IMAGE_CONFIDENCE
  return AUTO_APPLY_AI_CONFIDENCE
}

export function shouldAutoApplyCategorySuggestion(opts: {
  confidence: number
  suggestionSource?: "catalog" | "ai" | "keyword"
  hasImage: boolean
}): boolean {
  if (opts.suggestionSource === "keyword" && !opts.hasImage) return false
  return opts.confidence >= minConfidenceForAutoApply(opts)
}

/** Trigger listing suggest API when we have enough signal. */
export function hasListingClassificationSignal(title: string, imageUrl?: string | null): boolean {
  const t = title.trim()
  const img = imageUrl?.trim()
  if (img && img.length > 8) return true
  return t.length >= 3
}

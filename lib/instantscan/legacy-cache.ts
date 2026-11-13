import { normalizeInstantScanStage, type InstantScanProvenance } from "@/lib/instantscan/stages"

/**
 * Analyses cached BEFORE the honesty fix (Redis TTL 24 h) carry the old "embed" stage name and, for a catalog match, an
 * invented `confidence` (0.88 + similarity × 0.1). On read they are rewritten so the API never serves either again:
 * stage renamed, the made-up confidence dropped, the result flagged for review, provenance stated.
 *
 * Pure and structural (no import of the analyzer) so it is safe anywhere and easy to test.
 */
export type CachedAnalysisShape = {
  confidence?: number
  needsReview?: boolean
  instantScanStage?: string
  provenance?: InstantScanProvenance
  [key: string]: unknown
}

export function normalizeLegacyCachedAnalysis<T extends CachedAnalysisShape>(cached: T): T & CachedAnalysisShape {
  const rawStage = cached.instantScanStage
  if (rawStage === undefined) return cached

  const stage = normalizeInstantScanStage(rawStage)
  if (rawStage !== "embed") {
    return stage && stage !== rawStage ? { ...cached, instantScanStage: stage } : cached
  }

  const { confidence: _invented, ...rest } = cached
  void _invented
  return {
    ...rest,
    instantScanStage: "catalog_match",
    needsReview: true,
    provenance: cached.provenance ?? {
      method: "catalog_lexical_match",
      modelUsed: null,
      fallbackUsed: false,
      confidenceSource: "none",
      priceSource: "editorial_list",
    },
  } as unknown as T & CachedAnalysisShape
}

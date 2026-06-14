/** Benchmarks from other suppliers' Affisell catalog HT — never affiliate resale. */

export type CatalogPeerBenchmark = {
  peerCount: number
  medianCents: number | null
  p25Cents: number | null
  p75Cents: number | null
}

export type CatalogPriceSuggestionSource = "catalog_peers" | "margin_floor"

export type ResolvedCatalogPriceSuggestion = {
  suggestedPriceCents: number | null
  suggestedPriceSource: CatalogPriceSuggestionSource | null
  catalogPeerMedianCents: number | null
  catalogPeerCount: number
}

export const MIN_CATALOG_PEERS_FOR_BENCHMARK = 2

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo] ?? null
  const a = sorted[lo] ?? 0
  const b = sorted[hi] ?? 0
  return Math.round(a + (b - a) * (idx - lo))
}

export function buildCatalogPeerBenchmark(pricesCents: readonly number[]): CatalogPeerBenchmark {
  const sorted = [...pricesCents].filter((p) => p > 0).sort((a, b) => a - b)
  if (sorted.length === 0) {
    return { peerCount: 0, medianCents: null, p25Cents: null, p75Cents: null }
  }
  return {
    peerCount: sorted.length,
    medianCents: percentile(sorted, 0.5),
    p25Cents: percentile(sorted, 0.25),
    p75Cents: percentile(sorted, 0.75),
  }
}

/**
 * Primary suggestion = median catalog HT of peer suppliers in same category.
 * Falls back to margin-floor target when not enough peers. Never uses affiliate resale.
 */
export function resolveCatalogPriceSuggestion(input: {
  breakEvenPriceCents: number | null
  marginTargetPriceCents: number | null
  peer: CatalogPeerBenchmark | null
}): ResolvedCatalogPriceSuggestion {
  const peer = input.peer
  const peerCount = peer?.peerCount ?? 0
  const peerMedian = peer?.medianCents ?? null
  const floor = input.breakEvenPriceCents ?? 0

  if (peerCount >= MIN_CATALOG_PEERS_FOR_BENCHMARK && peerMedian != null && peerMedian > 0) {
    const suggested = Math.max(peerMedian, floor > 0 ? floor : 0)
    return {
      suggestedPriceCents: suggested,
      suggestedPriceSource: "catalog_peers",
      catalogPeerMedianCents: peerMedian,
      catalogPeerCount: peerCount,
    }
  }

  if (input.marginTargetPriceCents != null && input.marginTargetPriceCents > 0) {
    return {
      suggestedPriceCents: input.marginTargetPriceCents,
      suggestedPriceSource: "margin_floor",
      catalogPeerMedianCents: peerMedian,
      catalogPeerCount: peerCount,
    }
  }

  return {
    suggestedPriceCents: null,
    suggestedPriceSource: null,
    catalogPeerMedianCents: peerMedian,
    catalogPeerCount: peerCount,
  }
}

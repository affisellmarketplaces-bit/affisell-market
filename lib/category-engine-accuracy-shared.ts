/**
 * Catalogue-learning loop: how often do humans keep what the category engine proposed? (pure, no Prisma)
 *
 * Input = the engine's suggestion log + each product's CURRENT category. For every product only the LATEST suggestion
 * counts. A suggestion that was written onto the product (`applied`) and is still there = agreed; one that was written
 * and has since been changed = corrected (a labelled example: engine said X, a human decided Y).
 */

export type SuggestionObservation = {
  productId: string
  suggestedLeafId: string
  confidence: number
  applied: boolean
  createdAt: Date | string
  /** The product's category now; null = uncategorised. */
  currentLeafId: string | null
}

export type ConfusionPair = { fromLeafId: string; toLeafId: string; count: number }

export type ConfidenceBucket = { label: string; applied: number; agreed: number; agreementRate: number | null }

export type CategoryEngineAccuracy = {
  products: number
  applied: number
  agreed: number
  corrected: number
  /** Applied suggestions whose product has since lost its category (treated as neither agreed nor corrected). */
  cleared: number
  /** agreed / (agreed + corrected); null while nothing has been settled. */
  agreementRate: number | null
  topConfusions: ConfusionPair[]
  byConfidence: ConfidenceBucket[]
}

const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "0.52–0.72", min: 0.52, max: 0.72 },
  { label: "0.72–0.85", min: 0.72, max: 0.85 },
  { label: "0.85–1.00", min: 0.85, max: Number.POSITIVE_INFINITY },
]

function timeOf(value: Date | string): number {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function rate(agreed: number, corrected: number): number | null {
  const settled = agreed + corrected
  return settled === 0 ? null : Math.round((agreed / settled) * 1000) / 1000
}

/** The latest observation per product (ties: the later array position wins). */
export function latestPerProduct(observations: readonly SuggestionObservation[]): SuggestionObservation[] {
  const latest = new Map<string, SuggestionObservation>()
  for (const o of observations) {
    const prev = latest.get(o.productId)
    if (!prev || timeOf(o.createdAt) >= timeOf(prev.createdAt)) latest.set(o.productId, o)
  }
  return [...latest.values()]
}

export function summarizeCategoryEngineAccuracy(
  observations: readonly SuggestionObservation[],
  options: { topConfusions?: number } = {}
): CategoryEngineAccuracy {
  const rows = latestPerProduct(observations)
  let applied = 0
  let agreed = 0
  let corrected = 0
  let cleared = 0
  const confusions = new Map<string, ConfusionPair>()
  const buckets = BUCKETS.map((b) => ({ ...b, applied: 0, agreed: 0, corrected: 0 }))

  for (const row of rows) {
    if (!row.applied) continue
    applied += 1
    const bucket = buckets.find((b) => row.confidence >= b.min && row.confidence < b.max)
    if (bucket) bucket.applied += 1

    if (row.currentLeafId == null) {
      cleared += 1
    } else if (row.currentLeafId === row.suggestedLeafId) {
      agreed += 1
      if (bucket) bucket.agreed += 1
    } else {
      corrected += 1
      if (bucket) bucket.corrected += 1
      const key = `${row.suggestedLeafId}→${row.currentLeafId}`
      const entry = confusions.get(key) ?? { fromLeafId: row.suggestedLeafId, toLeafId: row.currentLeafId, count: 0 }
      entry.count += 1
      confusions.set(key, entry)
    }
  }

  return {
    products: rows.length,
    applied,
    agreed,
    corrected,
    cleared,
    agreementRate: rate(agreed, corrected),
    topConfusions: [...confusions.values()]
      .sort((a, b) => b.count - a.count || a.fromLeafId.localeCompare(b.fromLeafId))
      .slice(0, options.topConfusions ?? 10),
    byConfidence: buckets.map((b) => ({
      label: b.label,
      applied: b.applied,
      agreed: b.agreed,
      agreementRate: rate(b.agreed, b.corrected),
    })),
  }
}

/** Labelled examples: where the engine's applied category was changed (engine said `from`, a human chose `to`). */
export function extractCorrections(
  observations: readonly SuggestionObservation[]
): { productId: string; fromLeafId: string; toLeafId: string; confidence: number }[] {
  return latestPerProduct(observations).flatMap((o) =>
    o.applied && o.currentLeafId != null && o.currentLeafId !== o.suggestedLeafId
      ? [{ productId: o.productId, fromLeafId: o.suggestedLeafId, toLeafId: o.currentLeafId, confidence: o.confidence }]
      : []
  )
}

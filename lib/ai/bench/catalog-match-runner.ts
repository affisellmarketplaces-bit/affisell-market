import type { BenchPrediction, BenchRunner } from "@/lib/ai/bench/instantscan-bench"
import type { CatalogEmbedMatch, CatalogRow } from "@/lib/ai/product-embeddings"
import type { VisualCuesExtraction } from "@/lib/ai/product-vision-cascade"

/**
 * Connects the bench to the PRODUCTION catalog-match code path (the functions of lib/ai/product-vision-cascade.ts and
 * lib/ai/product-embeddings.ts are passed in, not re-implemented here, so the bench measures what production runs).
 *
 *   vision model raw JSON -> parseCues -> toVector -> rank against the catalog -> accept above `threshold`, else abstain
 *
 * `askVisionModel` is the only part that differs between the two uses: a scripted answer in the test (SIMULATED model),
 * a real OpenAI vision call in scripts/bench-instantscan.ts (REAL model).
 */
export type CatalogMatchRunnerDeps<I> = {
  askVisionModel: (input: I) => Promise<string>
  parseCues: (raw: string) => VisualCuesExtraction
  toVector: (cues: VisualCuesExtraction) => Promise<number[]>
  catalog: CatalogRow[]
  rank: (
    vector: number[],
    catalog: CatalogRow[],
    hintModel: string | null,
    limit: number
  ) => CatalogEmbedMatch[]
  /** Same acceptance threshold as production (`CASCADE_MATCH_THRESHOLD`). */
  threshold: number
  limit?: number
}

export function createCatalogMatchRunner<I>(deps: CatalogMatchRunnerDeps<I>): BenchRunner<I> {
  const limit = deps.limit ?? 5
  return async (benchCase): Promise<BenchPrediction> => {
    const raw = await deps.askVisionModel(benchCase.input)
    const cues = deps.parseCues(raw)
    const vector = await deps.toVector(cues)
    const ranked = deps.rank(vector, deps.catalog, cues.model, limit)
    const best = ranked[0]
    return {
      ranked: ranked.map((r) => r.product.id),
      answered: best && best.score >= deps.threshold ? best.product.id : null,
    }
  }
}

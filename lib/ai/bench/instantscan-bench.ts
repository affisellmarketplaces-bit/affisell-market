import { latencyPercentiles, type Percentiles } from "@/lib/ai/usage-stats"

/**
 * Accuracy / latency BENCH for InstantScan's catalog-match step — a measuring instrument, not a result.
 *
 * Pure (no I/O, no env, no network, no clock of its own): the code under test and the clock are injected, so the same
 * harness runs
 *   - in vitest, with a SIMULATED model and SYNTHETIC labelled cases (lib/__tests__/instantscan-benchmark.test.ts), and
 *   - from scripts/bench-instantscan.ts, with a REAL model and REAL labelled photos (docs/AI-HONESTY-AND-MEASUREMENT.md).
 *
 * What a report means depends ENTIRELY on `datasetKind`: a report over synthetic cases and a simulated model measures the
 * lexical matcher on invented text — it says nothing about the product's accuracy on real photos, and `formatBenchReport`
 * says so on its first line. Only a report with `datasetKind: "real"` and a real model can support an accuracy statement.
 */

export type BenchCase<I = unknown> = {
  id: string
  /**
   * Ground truth: the catalog entry id the photo really shows, or `null` when the real product is NOT in the catalog
   * (the right behaviour is then to abstain and let the full vision model answer).
   */
  truth: string | null
  /** What the runner needs (for the catalog step: the vision model's raw JSON answer, or the photo for a real run). */
  input: I
  /** True when the case was written by hand for tests (no real photo, no real model). */
  synthetic: boolean
}

export type BenchPrediction = {
  /** Catalog ids ranked best first (a few are enough: the harness reads up to the largest k requested). */
  ranked: string[]
  /** Id the production step would ACCEPT (similarity ≥ threshold), or `null` when it abstains. */
  answered: string | null
}

export type BenchRunner<I = unknown> = (benchCase: BenchCase<I>) => Promise<BenchPrediction>

export type BenchCaseResult = {
  id: string
  truth: string | null
  answered: string | null
  rank: number | null
  latencyMs: number
}

export type BenchReport = {
  datasetKind: "synthetic" | "real" | "mixed"
  /** All cases. */
  n: number
  /** Cases whose truth is in the catalog / not in it. */
  inCatalog: number
  outOfCatalog: number
  /** Fraction (0..1) of in-catalog cases whose true entry is within the first k ranked candidates. `null` = no such case. */
  topK: Record<number, number | null>
  /** Production behaviour: the step either answers or abstains. */
  answered: number
  /** answered / n. */
  coverage: number | null
  /** Of the answers given, the fraction that named the true entry. `null` when it never answered. */
  precisionWhenAnswering: number | null
  /** Of the out-of-catalog photos, the fraction wrongly matched to some catalog entry. `null` when there is none. */
  falseAcceptRate: number | null
  /** Wall time of each case measured around the runner with the injected clock. */
  latencyMs: Percentiles
  cases: BenchCaseResult[]
}

export type RunBenchOptions = {
  ks?: number[]
  /** Monotonic clock in ms. Inject a fake one in tests; defaults to `performance.now`. */
  now?: () => number
}

function fraction(num: number, den: number): number | null {
  return den === 0 ? null : num / den
}

export async function runBench<I>(
  cases: readonly BenchCase<I>[],
  runner: BenchRunner<I>,
  options: RunBenchOptions = {}
): Promise<BenchReport> {
  const ks = [...new Set(options.ks ?? [1, 3, 5])].sort((a, b) => a - b)
  const now = options.now ?? (() => performance.now())

  const results: BenchCaseResult[] = []
  for (const benchCase of cases) {
    const t0 = now()
    const prediction = await runner(benchCase)
    const latencyMs = Math.max(0, now() - t0)
    const index = benchCase.truth === null ? -1 : prediction.ranked.indexOf(benchCase.truth)
    results.push({
      id: benchCase.id,
      truth: benchCase.truth,
      answered: prediction.answered,
      rank: index >= 0 ? index + 1 : null,
      latencyMs,
    })
  }

  const inCatalogResults = results.filter((r) => r.truth !== null)
  const outResults = results.filter((r) => r.truth === null)
  const answeredResults = results.filter((r) => r.answered !== null)
  const synthetic = cases.filter((c) => c.synthetic).length

  const topK: Record<number, number | null> = {}
  for (const k of ks) {
    topK[k] = fraction(
      inCatalogResults.filter((r) => r.rank !== null && r.rank <= k).length,
      inCatalogResults.length
    )
  }

  return {
    datasetKind: synthetic === cases.length ? "synthetic" : synthetic === 0 ? "real" : "mixed",
    n: results.length,
    inCatalog: inCatalogResults.length,
    outOfCatalog: outResults.length,
    topK,
    answered: answeredResults.length,
    coverage: fraction(answeredResults.length, results.length),
    precisionWhenAnswering: fraction(
      answeredResults.filter((r) => r.answered === r.truth).length,
      answeredResults.length
    ),
    falseAcceptRate: fraction(outResults.filter((r) => r.answered !== null).length, outResults.length),
    latencyMs: latencyPercentiles(results.map((r) => r.latencyMs)),
    cases: results,
  }
}

/**
 * Throws when the bench is not really connected: no case, no in-catalog case, or no latency measured. A bench that
 * "passes" because nothing was measured must fail loudly (this is what lets a test detect an unplugged harness).
 */
export function assertBenchIsWired(report: BenchReport, minCases = 20): void {
  if (report.n < minCases) {
    throw new Error(`bench_not_wired: ${report.n} case(s) measured, at least ${minCases} required`)
  }
  if (report.inCatalog === 0 || report.outOfCatalog === 0) {
    throw new Error("bench_not_wired: the labelled set needs in-catalog AND out-of-catalog cases")
  }
  // A model call cannot take 0 ms: an all-zero latency means nothing was timed (frozen or missing clock).
  if (report.latencyMs.p50 === null || report.latencyMs.p95 === null || report.latencyMs.p95 <= 0) {
    throw new Error("bench_not_wired: no latency measured")
  }
}

function pct(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)} %`
}

/** Human-readable report. The first line states what the numbers are worth. */
export function formatBenchReport(report: BenchReport, modelLabel: string): string {
  const scope =
    report.datasetKind === "real"
      ? `REAL labelled photos, model: ${modelLabel}`
      : `${report.datasetKind.toUpperCase()} cases, model: ${modelLabel} — NOT a product performance`
  const ks = Object.keys(report.topK)
    .map(Number)
    .sort((a, b) => a - b)
  return [
    `InstantScan catalog-match bench — ${scope}`,
    `cases: ${report.n} (in catalog: ${report.inCatalog}, out of catalog: ${report.outOfCatalog})`,
    ...ks.map((k) => `top-${k} (in-catalog cases): ${pct(report.topK[k] ?? null)}`),
    `coverage (step answers instead of abstaining): ${pct(report.coverage)}`,
    `precision when it answers: ${pct(report.precisionWhenAnswering)}`,
    `false accept (out-of-catalog photo matched anyway): ${pct(report.falseAcceptRate)}`,
    `latency p50 / p95 (ms): ${report.latencyMs.p50 ?? "n/a"} / ${report.latencyMs.p95 ?? "n/a"}`,
  ].join("\n")
}

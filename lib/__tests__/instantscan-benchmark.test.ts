import { describe, expect, it, vi } from "vitest"

import { createCatalogMatchRunner } from "@/lib/ai/bench/catalog-match-runner"
import {
  createFakeClock,
  createSimulatedVisionModel,
  SYNTHETIC_BENCH_CASES,
  type SyntheticInput,
} from "@/lib/ai/bench/fixtures/instantscan-synthetic-cases"
import {
  assertBenchIsWired,
  formatBenchReport,
  runBench,
  type BenchCase,
  type BenchRunner,
} from "@/lib/ai/bench/instantscan-bench"
import { hashedLexicalVector } from "@/lib/ai/openai-embeddings"
import {
  buildCatalogVectorIndex,
  CASCADE_MATCH_THRESHOLD,
  cuesToLexicalVector,
  rankCatalogByVector,
  resetCatalogVectorIndexForTests,
} from "@/lib/ai/product-embeddings"
import { parseVisualCuesPayload } from "@/lib/ai/product-vision-cascade"

/**
 * Replaces the old "precision on 15 flagship SKUs (deterministic embed self-match)" test, which fed a text to the same
 * function twice and asserted it matched itself (cosine of a vector with itself — a tautology that could never fail and
 * measured nothing).
 *
 * What is measured here: the PRODUCTION catalog-match path (parseVisualCuesPayload -> cuesToLexicalVector ->
 * rankCatalogByVector, with the production threshold) on a SYNTHETIC labelled set whose 'vision model' is a script.
 * The figures are therefore a regression guard on the matcher — NOT the accuracy of InstantScan, which has never been
 * measured on real photos (see docs/AI-HONESTY-AND-MEASUREMENT.md for the method).
 */

async function buildWiredRunner(clock: ReturnType<typeof createFakeClock>) {
  resetCatalogVectorIndexForTests()
  const catalog = await buildCatalogVectorIndex()
  const spies = {
    parseCues: vi.fn(parseVisualCuesPayload),
    toVector: vi.fn(cuesToLexicalVector),
    rank: vi.fn(rankCatalogByVector),
  }
  const runner = createCatalogMatchRunner<SyntheticInput>({
    askVisionModel: createSimulatedVisionModel(clock),
    parseCues: spies.parseCues,
    toVector: spies.toVector,
    catalog,
    rank: spies.rank,
    threshold: CASCADE_MATCH_THRESHOLD,
  })
  return { runner, spies, catalog }
}

describe("InstantScan catalog-match bench (synthetic cases, simulated model)", () => {
  it("every case is declared synthetic and the report says so", async () => {
    const clock = createFakeClock()
    const { runner } = await buildWiredRunner(clock)
    const report = await runBench(SYNTHETIC_BENCH_CASES, runner, { now: clock.now })

    expect(SYNTHETIC_BENCH_CASES.every((c) => c.synthetic === true)).toBe(true)
    expect(report.datasetKind).toBe("synthetic")
    const text = formatBenchReport(report, "simulated (scripted)")
    expect(text.split("\n")[0]).toContain("SYNTHETIC")
    expect(text.split("\n")[0]).toContain("NOT a product performance")
  })

  it("computes top-k, abstention, false-accept and p50/p95 latency through the production path", async () => {
    const clock = createFakeClock()
    const { runner, spies } = await buildWiredRunner(clock)
    const report = await runBench(SYNTHETIC_BENCH_CASES, runner, { now: clock.now })

    // wired: each production step ran once per case (a runner that does not call them cannot satisfy this)
    expect(spies.parseCues).toHaveBeenCalledTimes(SYNTHETIC_BENCH_CASES.length)
    expect(spies.toVector).toHaveBeenCalledTimes(SYNTHETIC_BENCH_CASES.length)
    expect(spies.rank).toHaveBeenCalledTimes(SYNTHETIC_BENCH_CASES.length)
    assertBenchIsWired(report)

    expect(report.n).toBe(SYNTHETIC_BENCH_CASES.length)
    expect(report.inCatalog).toBe(SYNTHETIC_BENCH_CASES.filter((c) => c.truth !== null).length)
    expect(report.outOfCatalog).toBe(SYNTHETIC_BENCH_CASES.filter((c) => c.truth === null).length)

    // top-k is monotonic and bounded
    const { 1: top1, 3: top3, 5: top5 } = report.topK
    expect(top1).not.toBeNull()
    expect(top1!).toBeGreaterThanOrEqual(0)
    expect(top1!).toBeLessThanOrEqual(top3!)
    expect(top3!).toBeLessThanOrEqual(top5!)
    expect(top5!).toBeLessThanOrEqual(1)

    // latency comes from the injected clock: p50/p95 of the scripted delays, deterministic
    const delays = SYNTHETIC_BENCH_CASES.map((c) => c.input.simulatedLatencyMs).sort((a, b) => a - b)
    expect(report.latencyMs.p50).toBe(delays[Math.ceil(0.5 * delays.length) - 1])
    expect(report.latencyMs.p95).toBe(delays[Math.ceil(0.95 * delays.length) - 1])
    expect(report.latencyMs.p50!).toBeLessThanOrEqual(report.latencyMs.p95!)

    // Pinned for the CURRENT matcher and the CURRENT synthetic set (regression guard, not a performance claim). If you tune
    // the matcher or the catalog on purpose, re-run the bench, read the report, and update these numbers in the same commit.
    expect(report.topK[1]).toBeCloseTo(PINNED.top1, 5)
    expect(report.topK[3]).toBeCloseTo(PINNED.top3, 5)
    expect(report.topK[5]).toBeCloseTo(PINNED.top5, 5)
    expect(report.coverage).toBeCloseTo(PINNED.coverage, 5)
    expect(report.precisionWhenAnswering).toBeCloseTo(PINNED.precisionWhenAnswering, 5)
    expect(report.falseAcceptRate).toBeCloseTo(PINNED.falseAcceptRate, 5)
    expect(report.latencyMs.p50).toBe(PINNED.p50)
    expect(report.latencyMs.p95).toBe(PINNED.p95)
  })

  it("documents the real behaviour of the production threshold: even on clean cues the step mostly abstains", async () => {
    const clock = createFakeClock()
    const { runner } = await buildWiredRunner(clock)
    const report = await runBench(SYNTHETIC_BENCH_CASES, runner, { now: clock.now })
    // The true entry is almost always ranked first, but the lexical score rarely reaches the 0.95 acceptance threshold:
    // the 'fast path' hands over to the full vision model far more often than it answers.
    expect(report.topK[1]!).toBeGreaterThan(report.coverage!)
    expect(report.coverage!).toBeLessThan(0.5)
  })

  it("is a real instrument: an oracle scores 100 %, a mute runner 0 %, an always-wrong runner 0 % and false accepts", async () => {
    const clock = createFakeClock()
    const oracle: BenchRunner<SyntheticInput> = async (c) => ({
      ranked: c.truth ? [c.truth] : [],
      answered: c.truth,
    })
    const mute: BenchRunner<SyntheticInput> = async () => ({ ranked: [], answered: null })
    const alwaysWrong: BenchRunner<SyntheticInput> = async () => ({
      ranked: ["not-a-real-id"],
      answered: "not-a-real-id",
    })

    const o = await runBench(SYNTHETIC_BENCH_CASES, oracle, { now: clock.now })
    expect(o.topK[1]).toBe(1)
    expect(o.precisionWhenAnswering).toBe(o.inCatalog / o.answered)
    expect(o.falseAcceptRate).toBe(0)

    const m = await runBench(SYNTHETIC_BENCH_CASES, mute, { now: clock.now })
    expect(m.topK[1]).toBe(0)
    expect(m.coverage).toBe(0)
    expect(m.precisionWhenAnswering).toBeNull()
    expect(m.falseAcceptRate).toBe(0)

    const w = await runBench(SYNTHETIC_BENCH_CASES, alwaysWrong, { now: clock.now })
    expect(w.topK[1]).toBe(0)
    expect(w.precisionWhenAnswering).toBe(0)
    expect(w.falseAcceptRate).toBe(1)
  })

  it("fails when the bench is not wired (no case, no latency, one-sided labels)", async () => {
    const clock = createFakeClock()
    const { runner } = await buildWiredRunner(clock)

    const empty = await runBench([] as BenchCase<SyntheticInput>[], runner, { now: clock.now })
    expect(() => assertBenchIsWired(empty)).toThrow(/bench_not_wired/)

    const onlyIn = SYNTHETIC_BENCH_CASES.filter((c) => c.truth !== null)
    const oneSided = await runBench(onlyIn, runner, { now: clock.now })
    expect(() => assertBenchIsWired(oneSided, 5)).toThrow(/out-of-catalog/)

    // too few cases to mean anything
    const few = await runBench(SYNTHETIC_BENCH_CASES.slice(0, 3), runner, { now: clock.now })
    expect(() => assertBenchIsWired(few)).toThrow(/at least 20/)

    // a clock that never moves reports 0 ms for every case: nothing was timed, so the bench is not wired
    const frozen = createFakeClock()
    const noTime = await runBench(SYNTHETIC_BENCH_CASES, runner, { now: frozen.now })
    expect(noTime.latencyMs.p95).toBe(0)
    expect(() => assertBenchIsWired(noTime)).toThrow(/no latency measured/)
  })

  it("is sensitive to the production catalog: dropping the true entry loses exactly that case", async () => {
    const clock = createFakeClock()
    const { runner, catalog } = await buildWiredRunner(clock)
    const full = await runBench(SYNTHETIC_BENCH_CASES, runner, { now: clock.now })

    const without = catalog.filter((row) => row.id !== "iphone-17-pro")
    const reducedRunner = createCatalogMatchRunner<SyntheticInput>({
      askVisionModel: createSimulatedVisionModel(clock),
      parseCues: parseVisualCuesPayload,
      toVector: cuesToLexicalVector,
      catalog: without,
      rank: rankCatalogByVector,
      threshold: CASCADE_MATCH_THRESHOLD,
    })
    const reduced = await runBench(SYNTHETIC_BENCH_CASES, reducedRunner, { now: clock.now })

    const lostRank1 = full.cases.find((r) => r.id === "iphone-17-pro/clean")
    const nowRank = reduced.cases.find((r) => r.id === "iphone-17-pro/clean")
    expect(lostRank1?.rank).toBe(1)
    expect(nowRank?.rank).toBeNull()
    expect(reduced.topK[1]!).toBeLessThan(full.topK[1]!)
  })

  it("is sensitive to the model's answer: a worse simulated model gives a worse score", async () => {
    const clock = createFakeClock()
    const { runner } = await buildWiredRunner(clock)
    const good = await runBench(SYNTHETIC_BENCH_CASES, runner, { now: clock.now })

    const garbled: BenchCase<SyntheticInput>[] = SYNTHETIC_BENCH_CASES.map((c) => ({
      ...c,
      input: { ...c.input, modelAnswer: "not json at all" },
    }))
    const bad = await runBench(garbled, runner, { now: clock.now })
    expect(bad.topK[1]!).toBeLessThan(good.topK[1]!)
  })

  it("the hashed vector only measures lexical overlap — it knows no synonyms", () => {
    // 'smartphone' vs 'téléphone portable': same meaning, no shared words => far below the 0.95 acceptance threshold
    const a = hashedLexicalVector("smartphone")
    const b = hashedLexicalVector("téléphone portable")
    const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0)
    expect(dot).toBeLessThan(CASCADE_MATCH_THRESHOLD)
  })
})

describe("scripts/bench-instantscan.ts helpers (the real-model run itself is never executed by tests)", () => {
  it("refuses by default: nothing runs without --real and a dataset", async () => {
    const { parseArgs } = await import("../../scripts/bench-instantscan")
    expect(parseArgs([])).toEqual({ dataset: null, real: false })
    expect(parseArgs(["--dataset", "x.json"])).toEqual({ dataset: "x.json", real: false })
    expect(parseArgs(["--real", "--dataset", "x.json"])).toEqual({ dataset: "x.json", real: true })
  })

  it("loads a human-labelled dataset as REAL cases and rejects malformed ones", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const { loadRealDataset } = await import("../../scripts/bench-instantscan")
    const dir = mkdtempSync(join(tmpdir(), "bench-"))

    const good = join(dir, "good.json")
    writeFileSync(
      good,
      JSON.stringify([
        { id: "a", imageUrl: "https://cdn.example/a.jpg", truth: "iphone-17-pro" },
        { id: "b", imageUrl: "https://cdn.example/b.jpg", truth: null },
      ])
    )
    const cases = loadRealDataset(good)
    expect(cases.every((c) => c.synthetic === false)).toBe(true)
    expect(cases.map((c) => c.truth)).toEqual(["iphone-17-pro", null])

    const http = join(dir, "http.json")
    writeFileSync(http, JSON.stringify([{ id: "a", imageUrl: "http://insecure.example/a.jpg", truth: null }]))
    expect(() => loadRealDataset(http)).toThrow(/https/)

    const empty = join(dir, "empty.json")
    writeFileSync(empty, "[]")
    expect(() => loadRealDataset(empty)).toThrow(/non-empty/)
  })

  it("a report over real cases is labelled REAL, over synthetic cases it is never", async () => {
    const clock = createFakeClock()
    const mute: BenchRunner<unknown> = async () => ({ ranked: [], answered: null })
    const real = await runBench([{ id: "r", truth: null, input: {}, synthetic: false }], mute, { now: clock.now })
    expect(real.datasetKind).toBe("real")
    expect(formatBenchReport(real, "gpt-4o-mini").split("\n")[0]).toContain("REAL labelled photos")
    const mixed = await runBench(
      [
        { id: "r", truth: null, input: {}, synthetic: false },
        { id: "s", truth: null, input: {}, synthetic: true },
      ],
      mute,
      { now: clock.now }
    )
    expect(mixed.datasetKind).toBe("mixed")
    expect(formatBenchReport(mixed, "x").split("\n")[0]).toContain("NOT a product performance")
  })
})

// Measured by running this bench on the 24 synthetic cases (18 in catalog, 6 out) against the 81-entry curated catalog.
// 'coverage' 5/24: on these CLEAN, hand-written cues the step still accepts only 5 matches at the 0.95 threshold.
const PINNED = {
  top1: 16 / 18,
  top3: 16 / 18,
  top5: 17 / 18,
  coverage: 5 / 24,
  precisionWhenAnswering: 1,
  falseAcceptRate: 0,
  p50: 590,
  p95: 800,
}

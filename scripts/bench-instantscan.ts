/**
 * Accuracy / latency bench of InstantScan's catalog-match step against a REAL vision model and REAL labelled photos.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/bench-instantscan.ts --dataset <file.json> --real
 *
 * It is NEVER run by CI, by `npm test` or by the app. Without `--real` it refuses to start (no network call, no spend).
 * With `--real` it calls the OpenAI vision model once per case (cost: see /admin/instantscan-performance or the `[ai-usage]`
 * log lines it prints) and writes NOTHING to a database. The method, the dataset format and how to read the report are in
 * docs/AI-HONESTY-AND-MEASUREMENT.md.
 *
 * Dataset file (JSON array) — one entry per real photo, labelled by a human:
 *   [{ "id": "photo-001", "imageUrl": "https://…/photo.jpg", "truth": "iphone-17-pro" },
 *    { "id": "photo-002", "imageUrl": "https://…/lamp.jpg",  "truth": null }]
 * `truth` is an id of lib/ai/curated-product-catalog.ts, or null when the photographed product is not in the catalog.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { createCatalogMatchRunner } from "../lib/ai/bench/catalog-match-runner"
import { assertBenchIsWired, formatBenchReport, runBench, type BenchCase } from "../lib/ai/bench/instantscan-bench"

type RealInput = { imageUrl: string }

export type ParsedArgs = { dataset: string | null; real: boolean }

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { dataset: null, real: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--real") out.real = true
    else if (a === "--dataset") out.dataset = argv[++i] ?? null
  }
  return out
}

/** Validates the dataset file; every case is flagged `synthetic: false` (they are real, human-labelled photos). */
export function loadRealDataset(path: string): BenchCase<RealInput>[] {
  const raw: unknown = JSON.parse(readFileSync(resolve(path), "utf8"))
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("dataset must be a non-empty JSON array")
  return raw.map((row, i) => {
    const r = row as Record<string, unknown>
    if (typeof r.id !== "string" || !r.id) throw new Error(`case #${i}: "id" is required`)
    if (typeof r.imageUrl !== "string" || !/^https:\/\//.test(r.imageUrl)) {
      throw new Error(`case ${r.id}: "imageUrl" must be an https URL of a real photo`)
    }
    if (r.truth !== null && typeof r.truth !== "string") {
      throw new Error(`case ${r.id}: "truth" must be a catalog id or null`)
    }
    return { id: r.id, truth: r.truth as string | null, input: { imageUrl: r.imageUrl }, synthetic: false }
  })
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!args.real || !args.dataset) {
    console.error(
      "Refusing to run: this bench calls a paid vision model once per photo.\n" +
        "Pass --real and --dataset <file.json> to run it on purpose (see docs/AI-HONESTY-AND-MEASUREMENT.md).\n" +
        "No network call was made."
    )
    process.exit(2)
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("OPENAI_API_KEY is not set in the environment: nothing to measure. No network call was made.")
    process.exit(2)
  }

  const cases = loadRealDataset(args.dataset)

  // Production functions, imported lazily so a refused run never loads the model clients.
  const { openaiChatCompletion } = await import("../lib/ai/openai-chat-fallback")
  const { PRODUCT_VISION_CASCADE_MINI_MODEL } = await import("../lib/ai/product-vision-v2-config")
  const { buildCatalogVectorIndex, CASCADE_MATCH_THRESHOLD, cuesToLexicalVector, rankCatalogByVector } = await import(
    "../lib/ai/product-embeddings"
  )
  const { parseVisualCuesPayload, CUES_PROMPT } = await import("../lib/ai/product-vision-cascade")

  const catalog = await buildCatalogVectorIndex()
  const runner = createCatalogMatchRunner<RealInput>({
    askVisionModel: async ({ imageUrl }) => {
      const completion = await openaiChatCompletion({
        model: PRODUCT_VISION_CASCADE_MINI_MODEL,
        vision: true,
        temperature: 0,
        max_tokens: 180,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CUES_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extrais brand, model, visualCues, productType." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      })
      return completion?.text ?? ""
    },
    parseCues: parseVisualCuesPayload,
    toVector: cuesToLexicalVector,
    catalog,
    rank: rankCatalogByVector,
    threshold: CASCADE_MATCH_THRESHOLD,
  })

  const report = await runBench(cases, runner)
  assertBenchIsWired(report, Math.min(20, cases.length))
  console.log(formatBenchReport(report, PRODUCT_VISION_CASCADE_MINI_MODEL))
  console.log("\nPer-case results:")
  for (const c of report.cases) {
    console.log(`${c.id}\ttruth=${c.truth ?? "null"}\tanswered=${c.answered ?? "abstain"}\trank=${c.rank ?? "-"}\t${Math.round(c.latencyMs)} ms`)
  }
}

// Run only when executed directly (importing this file for its helpers must not start a run).
if (process.argv[1] && /bench-instantscan\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error("bench failed:", err instanceof Error ? err.message : err)
    process.exit(1)
  })
}

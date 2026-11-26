import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * What the usage journal covers, and what it does not — stated, then enforced.
 *
 * `lib/ai/usage-log.ts` used to claim that EVERY provider request goes through `meterModelCall`. It did not: the GPT-4o product
 * description generator and the plain Anthropic client called their provider directly. Both are metered now, and this test
 * fails if a NEW direct provider call appears in the application code without `meterModelCall` (or without being added, on
 * purpose, to the list of known unmetered endpoints below).
 */

const ROOT = process.cwd()

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "__tests__" || name.startsWith(".")) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) sourceFiles(full, out)
    else if (/\.(ts|tsx|mts)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(full)
  }
  return out
}

/** A direct request to an LLM provider: SDK chat / embeddings / generate calls or a raw fetch of a provider URL. */
const DIRECT_PROVIDER_CALL =
  /chat\.completions\.create\(|embeddings\.create\(|messages\.create\(|\.generateContent\(|api\.anthropic\.com\/v1\/messages|api\.openai\.com\/v1\/(chat|embeddings|completions)|api\.groq\.com\/openai\/v1\/chat/

/** Calls that are deliberately NOT metered (listed on the admin page and in the docs). Adding a file here is a decision. */
const KNOWN_UNMETERED: string[] = []

describe("every direct LLM provider call in the application is metered", () => {
  const files = ["app", "lib", "components", "hooks", "inngest"].flatMap((d) => {
    try {
      return sourceFiles(join(ROOT, d))
    } catch {
      return []
    }
  })

  it("finds the known provider clients (the scan is not empty)", () => {
    const callers = files.filter((f) => DIRECT_PROVIDER_CALL.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f))
    expect(callers).toEqual(
      expect.arrayContaining([
        "lib/ai/openai-chat-fallback.ts",
        "lib/ai/groq-client.ts",
        "lib/ai/anthropic-messages.ts",
        "lib/ai/anthropic-client.ts",
        "lib/ai/gemini-client.ts",
        "lib/ai/openai-embeddings.ts",
        "lib/affiliate-product-generate-description.ts",
      ])
    )
  })

  it("each of them calls meterModelCall", () => {
    const offenders = files
      .map((f) => ({ f: relative(ROOT, f), text: readFileSync(f, "utf8") }))
      // an actual CALL of the wrapper (`meterModelCall(` / `meterModelCall<T>(`), not merely an import of its name
      .filter(({ f, text }) => DIRECT_PROVIDER_CALL.test(text) && !/meterModelCall\s*[<(]/.test(text) && !KNOWN_UNMETERED.includes(f))
      .map(({ f }) => f)
    expect(offenders).toEqual([])
  })
})

describe("the coverage limits are stated where the numbers are shown", () => {
  it("the admin page and the doc say what is NOT journalled and that a cost is a minimum", () => {
    const page = readFileSync(join(ROOT, "app/admin/instantscan-performance/page.tsx"), "utf8")
    expect(page).toContain("Non journalisés")
    expect(page).toContain("modération")
    expect(page).toContain("minimum")
    const doc = readFileSync(join(ROOT, "docs/AI-HONESTY-AND-MEASUREMENT.md"), "utf8")
    expect(doc).toContain("Non couvert")
    expect(doc).toMatch(/un\s+minimum/)
    const header = readFileSync(join(ROOT, "lib/ai/usage-log.ts"), "utf8")
    expect(header).toContain("WHAT IS NOT COVERED")
    expect(header).not.toMatch(/Every request to a model provider/)
  })
})

const DESCRIPTION_INPUT = {
  name: "Lampe LED de bureau",
  supplierPriceEur: 12,
  images: [],
  specs: { material: "ABS", dimensions: "30 x 12 cm", extra: [] },
}

describe("the two call sites that used to bypass the journal", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.stubEnv("OPENAI_API_KEY", "sk-test")
    vi.stubEnv("ANTHROPIC_API_KEY", "ak-test")
  })
  afterEach(() => {
    vi.doUnmock("openai")
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("GPT-4o description generation is journalled with its real tokens and an estimated cost", async () => {
    const payload = {
      seoTitle: "Lampe LED bureau",
      accroche: "Une lampe qui t'éclaire sans fatigue.",
      benefices: ["Lumière douce", "Pliable", "USB"],
      storytelling: "Tu travailles tard ? Cette lampe suit ton rythme.",
      specs: [{ label: "Matériau", value: "ABS" }],
      faq: [{ q: "Livraison ?", a: "Sous 5 jours." }],
    }
    vi.doMock("openai", () => ({
      default: class OpenAI {
        chat = {
          completions: {
            create: async () => ({
              model: "gpt-4o-2024-08-06",
              choices: [{ message: { content: JSON.stringify(payload) } }],
              usage: { prompt_tokens: 900, completion_tokens: 400, total_tokens: 1300 },
            }),
          },
        }
      },
    }))
    const usageLog = await import("@/lib/ai/usage-log")
    usageLog.resetAiUsageForTests()
    const { generateProductDescriptionWithGpt4o } = await import("@/lib/affiliate-product-generate-description")
    const result = await generateProductDescriptionWithGpt4o(DESCRIPTION_INPUT)
    expect(result.benefices.length).toBeGreaterThanOrEqual(2)

    const { records } = await usageLog.readAiUsageRecords()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      kind: "model_call",
      feature: "product_description",
      tier: "generate_gpt4o",
      provider: "openai",
      modelRequested: "gpt-4o",
      modelUsed: "gpt-4o-2024-08-06",
      promptTokens: 900,
      completionTokens: 400,
      ok: true,
    })
    // 900 * 2.5 / 1e6 + 400 * 10 / 1e6 = 0.00225 + 0.004
    expect(records[0]!.costUsdEstimated).toBeCloseTo(0.00625, 8)
  })

  it("a failed GPT-4o description call is journalled as a failure and the error still propagates", async () => {
    vi.doMock("openai", () => ({
      default: class OpenAI {
        chat = {
          completions: {
            create: async () => {
              throw Object.assign(new Error("overloaded"), { status: 503 })
            },
          },
        }
      },
    }))
    const usageLog = await import("@/lib/ai/usage-log")
    usageLog.resetAiUsageForTests()
    const { generateProductDescriptionWithGpt4o } = await import("@/lib/affiliate-product-generate-description")
    await expect(generateProductDescriptionWithGpt4o(DESCRIPTION_INPUT)).rejects.toThrow("overloaded")
    const { records } = await usageLog.readAiUsageRecords()
    expect(records[0]).toMatchObject({ feature: "product_description", ok: false, error: "http_5xx", modelUsed: null })
  })

  it("anthropicChatText is journalled (Anthropic usage shape) and returns the same text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            content: [{ type: "text", text: "Bonjour" }],
            usage: { input_tokens: 120, output_tokens: 30 },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    )
    const usageLog = await import("@/lib/ai/usage-log")
    usageLog.resetAiUsageForTests()
    const { anthropicChatText } = await import("@/lib/ai/anthropic-client")
    const text = await anthropicChatText({ user: "Dis bonjour" })
    expect(text).toBe("Bonjour")

    const { records } = await usageLog.readAiUsageRecords()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      provider: "anthropic",
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
      ok: true,
      modelUsed: "claude-haiku-4-5-20251001",
    })
    // no price is known for this model: the cost is unknown, not guessed
    expect(records[0]!.costUsdEstimated).toBeNull()
  })

  it("anthropicChatText failures are journalled and keep their AnthropicError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { type: "overloaded_error", message: "busy" } }), { status: 529 }))
    )
    const usageLog = await import("@/lib/ai/usage-log")
    usageLog.resetAiUsageForTests()
    const { anthropicChatText } = await import("@/lib/ai/anthropic-client")
    await expect(anthropicChatText({ user: "x" })).rejects.toMatchObject({ name: "AnthropicError", status: 529 })
    const { records } = await usageLog.readAiUsageRecords()
    expect(records[0]).toMatchObject({ provider: "anthropic", ok: false, error: "http_5xx", modelUsed: null })
  })
})

import { anthropicChatText, hasAnthropicApiKey } from "@/lib/ai/anthropic-client"
import { groqChatText } from "@/lib/ai/groq-client"
import {
  buildPrompt,
  extractJsonObject,
  normalizeAiPayload,
  type OptimizeVariantsInput,
  type OptimizeVariantsResult,
} from "@/lib/supplier-optimize-variants-shared"

// Everything a client component needs lives in the -shared module; it is re-exported here so server code and tests keep one import path.
export {
  applyOptimizedSimpleColorNames,
  applyOptimizedSkuRows,
  buildPrompt,
  extractJsonObject,
  normalizeAiPayload,
} from "@/lib/supplier-optimize-variants-shared"
export type {
  OptimizeVariantsInput,
  OptimizeVariantsResult,
  OptimizeVariantsRowInput,
} from "@/lib/supplier-optimize-variants-shared"

export async function optimizeSupplierVariants(input: OptimizeVariantsInput): Promise<OptimizeVariantsResult> {
  const { system, user } = buildPrompt(input)

  // Claude first when configured (measured 95% vs 88% strict pass on 60 runs, see scripts/llm-eval); Groq is the fallback.
  let raw: string | null = null
  if (hasAnthropicApiKey()) {
    try {
      raw = await anthropicChatText({ system, user, maxTokens: 900, temperature: 0.25 })
    } catch (error) {
      console.warn("[supplier-optimize-variants]", {
        event: "claude_failed_fallback_groq",
        message: error instanceof Error ? error.message.slice(0, 160) : String(error),
      })
    }
  }
  if (!raw?.trim()) {
    raw = await groqChatText({
      vision: false,
      temperature: 0.25,
      max_tokens: 900,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    })
  }

  if (!raw?.trim()) {
    throw new Error("L'IA n'a pas renvoyé de texte.")
  }

  const parsed = extractJsonObject(raw)
  const result = normalizeAiPayload(input, parsed)

  console.log("[supplier-optimize-variants]", {
    mode: input.mode,
    rowCount: input.rows?.length ?? input.simpleColors?.length ?? 0,
    optimizedRows: result.rows?.length ?? result.simpleColors?.length ?? 0,
  })

  if (
    (input.mode === "simple" && (!result.simpleColors || result.simpleColors.length === 0)) ||
    (input.mode === "advanced" && (!result.rows || result.rows.length === 0))
  ) {
    throw new Error("Aucune variante optimisée — vérifiez les noms de couleur.")
  }

  return result
}

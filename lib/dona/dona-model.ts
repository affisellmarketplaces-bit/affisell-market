import { groq } from "@ai-sdk/groq"
import { openai } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

export type DonaModelProvider = "groq" | "openai"

export type DonaModelBundle = {
  primary: LanguageModel
  fallback: LanguageModel | null
  primaryProvider: DonaModelProvider
  fallbackProvider: DonaModelProvider | null
}

const GROQ_DONA_MODEL = "llama-3.3-70b-versatile" as const
const OPENAI_DONA_MODEL = "gpt-4o-mini" as const

/**
 * Groq first (Affisell standard) — OpenAI fallback when Groq key missing or rate-limited.
 * Returns null when no provider key is configured.
 */
export function resolveDonaModels(): DonaModelBundle | null {
  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim())
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim())

  if (hasGroq) {
    return {
      primary: groq(GROQ_DONA_MODEL),
      fallback: hasOpenAi ? openai(OPENAI_DONA_MODEL) : null,
      primaryProvider: "groq",
      fallbackProvider: hasOpenAi ? "openai" : null,
    }
  }

  if (hasOpenAi) {
    return {
      primary: openai(OPENAI_DONA_MODEL),
      fallback: null,
      primaryProvider: "openai",
      fallbackProvider: null,
    }
  }

  return null
}

export function isDonaProviderError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    /no credits|insufficient_quota|billing|rate.?limit|429|401|403|503|502|504|timeout|model_not_found|overloaded/i.test(
      msg
    ) || (error !== null &&
      typeof error === "object" &&
      "status" in error &&
      [401, 403, 429, 502, 503, 504].includes(Number((error as { status: unknown }).status)))
  )
}

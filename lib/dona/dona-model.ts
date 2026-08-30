import { groq } from "@ai-sdk/groq"
import { openai } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

export type DonaModelProvider = "groq" | "openai"

export type DonaModelAttempt = {
  model: LanguageModel
  provider: DonaModelProvider
  modelId: string
}

export type DonaModelBundle = {
  primary: LanguageModel
  fallback: LanguageModel | null
  primaryProvider: DonaModelProvider
  fallbackProvider: DonaModelProvider | null
}

/** Groq production chat default (Llama retired Aug 2026). */
export const DONA_GROQ_MODEL_DEFAULT = "openai/gpt-oss-20b" as const

const GROQ_MODEL_CHAIN = [
  DONA_GROQ_MODEL_DEFAULT,
  "openai/gpt-oss-120b",
  "qwen/qwen3.6-27b",
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
] as const

const OPENAI_DONA_MODEL = "gpt-4o-mini" as const

function uniqueGroqModelIds(): string[] {
  const raw = [
    process.env.DONA_GROQ_MODEL?.trim(),
    process.env.GROQ_TEXT_MODEL?.trim(),
    ...GROQ_MODEL_CHAIN,
  ].filter((id): id is string => Boolean(id?.trim()))

  return [...new Set(raw)]
}

/** Ordered attempts: Groq models (fast) → OpenAI fallback. */
export function resolveDonaModelAttempts(): DonaModelAttempt[] {
  const attempts: DonaModelAttempt[] = []
  const seen = new Set<string>()

  if (process.env.GROQ_API_KEY?.trim()) {
    for (const modelId of uniqueGroqModelIds()) {
      if (seen.has(modelId)) continue
      seen.add(modelId)
      attempts.push({ model: groq(modelId), provider: "groq", modelId })
    }
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    const openaiId = process.env.DONA_OPENAI_MODEL?.trim() || OPENAI_DONA_MODEL
    if (!seen.has(openaiId)) {
      attempts.push({ model: openai(openaiId), provider: "openai", modelId: openaiId })
    }
  }

  return attempts
}

/** @deprecated Prefer resolveDonaModelAttempts — kept for route guards. */
export function resolveDonaModels(): DonaModelBundle | null {
  const attempts = resolveDonaModelAttempts()
  if (attempts.length === 0) return null
  const [primary, fallback] = attempts
  return {
    primary: primary.model,
    fallback: fallback?.model ?? null,
    primaryProvider: primary.provider,
    fallbackProvider: fallback?.provider ?? null,
  }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object") {
    if ("message" in error) return String((error as { message: unknown }).message)
    if ("responseBody" in error) return String((error as { responseBody: unknown }).responseBody)
  }
  return String(error ?? "")
}

function extractErrorStatus(error: unknown): number {
  if (error && typeof error === "object" && "statusCode" in error) {
    return Number((error as { statusCode: unknown }).statusCode)
  }
  if (error && typeof error === "object" && "status" in error) {
    return Number((error as { status: unknown }).status)
  }
  return NaN
}

export function isDonaProviderError(error: unknown): boolean {
  const msg = extractErrorMessage(error).toLowerCase()
  if (
    /no credits|insufficient_quota|billing|rate.?limit|429|401|403|503|502|504|timeout|model_not_found|does not exist|not have access|overloaded|invalid_request_error/i.test(
      msg
    )
  ) {
    return true
  }
  const status = extractErrorStatus(error)
  return [401, 403, 404, 429, 502, 503, 504].includes(status)
}

import Groq from "groq-sdk"

import {
  capVisionImagesInMessages,
  GROQ_VISION_MAX_IMAGES,
  isGroqRateLimitError,
  normalizeGroqClientError,
} from "@/lib/ai/groq-vision"
import { routeLlmText } from "@/lib/ai/llm-router"
import { hasOpenAiFallback, openaiChatText } from "@/lib/ai/openai-chat-fallback"

export const GROQ_TEXT_MODEL =
  process.env.GROQ_TEXT_MODEL?.trim() || "llama-3.1-8b-instant"

/** Multimodal vision — Llama 4 Scout shut down 2026-07-17; use Qwen 3.6 vision. */
export const GROQ_VISION_MODEL_DEFAULT = "qwen/qwen3.6-27b"

const DEPRECATED_GROQ_MODELS: Record<string, string> = {
  "meta-llama/llama-4-scout-17b-16e-instruct": GROQ_VISION_MODEL_DEFAULT,
  "meta-llama/llama-4-maverick-17b-128e-instruct": GROQ_VISION_MODEL_DEFAULT,
  "qwen/qwen3-32b": GROQ_VISION_MODEL_DEFAULT,
}

/** Remap shut-down Groq model IDs so env overrides cannot resurrect 404s. */
export function resolveGroqModelId(model: string | undefined, vision: boolean): string {
  const raw = (model?.trim() || (vision ? GROQ_VISION_MODEL_DEFAULT : GROQ_TEXT_MODEL)).trim()
  const mapped = DEPRECATED_GROQ_MODELS[raw]
  if (mapped && mapped !== raw) {
    console.log("[groq-client]", { event: "deprecated_model_remapped", from: raw, to: mapped })
    return mapped
  }
  return raw
}

export const GROQ_VISION_MODEL = resolveGroqModelId(
  process.env.GROQ_VISION_MODEL,
  true
)

export { GROQ_VISION_MAX_IMAGES, isGroqRateLimitError }

export function getGroqApiKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim()
  return key || null
}

export function createGroqClient(): Groq | null {
  const apiKey = getGroqApiKey()
  if (!apiKey) return null
  return new Groq({ apiKey })
}

export type GroqChatOptions = {
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[]
  model?: string
  temperature?: number
  max_tokens?: number
  response_format?: { type: "json_object" }
  /** When true, defaults to {@link GROQ_VISION_MODEL}. */
  vision?: boolean
}

function prepareMessages(
  options: GroqChatOptions
): Groq.Chat.Completions.ChatCompletionMessageParam[] {
  return options.vision || options.model === GROQ_VISION_MODEL
    ? capVisionImagesInMessages(options.messages, GROQ_VISION_MAX_IMAGES)
    : options.messages
}

async function groqChatTextDirect(
  groq: Groq,
  options: GroqChatOptions
): Promise<string | null> {
  const vision = Boolean(options.vision || options.model === GROQ_VISION_MODEL)
  const model = resolveGroqModelId(
    options.model ?? (vision ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL),
    vision
  )
  const messages = prepareMessages({ ...options, model, vision })
  const completion = await groq.chat.completions.create({
    model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens,
    response_format: options.response_format,
  })
  return completion.choices[0]?.message?.content?.trim() ?? null
}

function shouldFallbackToOpenAi(err: unknown): boolean {
  if (isGroqRateLimitError(err)) return true
  const raw =
    err instanceof Error
      ? err.message
      : err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err)
  const status =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status: unknown }).status)
      : NaN
  if (status === 404 || status === 400) {
    return /model_not_found|does not exist|not have access|invalid_request_error/i.test(raw)
  }
  return /503|502|504|service unavailable|overloaded|timeout|model_not_found|does not exist/i.test(
    raw
  )
}

async function tryOpenAiFallback(
  options: GroqChatOptions,
  reason: string
): Promise<string | null> {
  if (!hasOpenAiFallback()) return null
  console.log("[groq-client]", { event: "openai_fallback", reason })
  return openaiChatText({
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: options.max_tokens,
    response_format: options.response_format,
    vision: options.vision || options.model === GROQ_VISION_MODEL,
    model: options.model,
  })
}

export async function groqChatText(options: GroqChatOptions): Promise<string | null> {
  const resolvedModel = resolveGroqModelId(
    options.model,
    Boolean(options.vision || options.model === GROQ_VISION_MODEL || options.model?.includes("llama-4"))
  )
  const useVision = Boolean(
    options.vision ||
      resolvedModel === GROQ_VISION_MODEL ||
      resolvedModel === GROQ_VISION_MODEL_DEFAULT ||
      resolvedModel.startsWith("qwen/")
  )
  const normalized: GroqChatOptions = { ...options, model: resolvedModel, vision: useVision }

  const runGroq = async (): Promise<string | null> => {
    const groq = createGroqClient()

    if (groq) {
      try {
        return await groqChatTextDirect(groq, normalized)
      } catch (err: unknown) {
        if (shouldFallbackToOpenAi(err)) {
          const fallback = await tryOpenAiFallback(
            normalized,
            isGroqRateLimitError(err) ? "groq_rate_limit" : "groq_unavailable"
          )
          if (fallback) return fallback
        }
        throw normalizeGroqClientError(err)
      }
    }

    const openaiOnly = await tryOpenAiFallback(normalized, "no_groq_key")
    if (openaiOnly) return openaiOnly

    return null
  }

  if (!useVision) {
    const result = await routeLlmText({
      messages: options.messages,
      runGroq,
    })
    return result.text
  }

  return runGroq()
}

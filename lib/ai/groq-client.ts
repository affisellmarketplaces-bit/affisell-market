import Groq from "groq-sdk"

import {
  byteplusChatText,
  BYTEPLUS_LLM_MODEL,
  hasBytePlusChat,
  BytePlusChatError,
} from "@/lib/ai/byteplus-client"
import {
  capVisionImagesInMessages,
  GROQ_VISION_MAX_IMAGES,
  isGroqRateLimitError,
  normalizeGroqClientError,
} from "@/lib/ai/groq-vision"
import { hasOpenAiFallback, openaiChatText } from "@/lib/ai/openai-chat-fallback"

export const GROQ_TEXT_MODEL = "llama-3.1-8b-instant"
export const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

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
  const messages = prepareMessages(options)
  const completion = await groq.chat.completions.create({
    model: options.model ?? (options.vision ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL),
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
  return /503|502|504|service unavailable|overloaded|timeout/i.test(raw)
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
  const useVision = Boolean(options.vision || options.model === GROQ_VISION_MODEL)

  if (!useVision && hasBytePlusChat()) {
    try {
      const byteplus = await byteplusChatText({
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        response_format: options.response_format,
      })
      if (byteplus) {
        console.log("[groq-client]", { event: "BytePlus Dola", model: BYTEPLUS_LLM_MODEL })
        return byteplus
      }
    } catch (err: unknown) {
      const status = err instanceof BytePlusChatError ? err.status : 0
      const message = err instanceof Error ? err.message : String(err)
      console.log("[groq-client]", {
        event: "byteplus_fallback_groq",
        status,
        message: message.slice(0, 200),
      })
    }
  }

  const groq = createGroqClient()

  if (groq) {
    try {
      return await groqChatTextDirect(groq, options)
    } catch (err: unknown) {
      if (shouldFallbackToOpenAi(err)) {
        const fallback = await tryOpenAiFallback(
          options,
          isGroqRateLimitError(err) ? "groq_rate_limit" : "groq_unavailable"
        )
        if (fallback) return fallback
      }
      throw normalizeGroqClientError(err)
    }
  }

  const openaiOnly = await tryOpenAiFallback(options, "no_groq_key")
  if (openaiOnly) return openaiOnly

  return null
}

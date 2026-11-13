import OpenAI from "openai"
import type Groq from "groq-sdk"

import { capVisionImagesInMessages, GROQ_VISION_MAX_IMAGES } from "@/lib/ai/groq-vision"
import { meterModelCall, normalizeUsage, type NormalizedUsage } from "@/lib/ai/usage-log"

export const OPENAI_TEXT_FALLBACK_MODEL =
  process.env.OPENAI_FALLBACK_MODEL?.trim() || "gpt-4o-mini"
export const OPENAI_VISION_FALLBACK_MODEL =
  process.env.OPENAI_VISION_FALLBACK_MODEL?.trim() || "gpt-4o-mini"

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return null
  return new OpenAI({ apiKey: key })
}

/** Hard cap so InstantScan never hangs past Vercel/route maxDuration. */
export const OPENAI_CHAT_TIMEOUT_MS = 45_000

export type OpenAiChatOptions = {
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[]
  model?: string
  temperature?: number
  max_tokens?: number
  response_format?: { type: "json_object" }
  vision?: boolean
  /** Override default OPENAI_CHAT_TIMEOUT_MS */
  timeoutMs?: number
}

export function hasOpenAiFallback(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

/**
 * What an OpenAI chat call REALLY did — not what the caller asked for.
 *  - `modelRequested`: the model id sent on the first attempt.
 *  - `modelUsed`: the model that answered (the provider's own `completion.model`, else the id we sent).
 *  - `fallbackUsed`: true when the first attempt failed and the answer comes from the fallback model
 *    (OPENAI_VISION_FALLBACK_MODEL / OPENAI_FALLBACK_MODEL, `gpt-4o-mini` by default). Callers MUST surface it: a result
 *    produced by the fallback must never keep the label of the model that failed.
 */
export type OpenAiChatCompletion = {
  text: string | null
  modelRequested: string
  modelUsed: string
  fallbackUsed: boolean
  /** The provider's own token counts (nulls when it returned none). */
  usage: NormalizedUsage
}

/**
 * Same call as {@link openaiChatText} but returns the model that actually answered and the real token usage. Every request
 * (the first attempt AND the fallback attempt) is measured by lib/ai/usage-log.ts under the caller's usage context.
 */
export async function openaiChatCompletion(
  options: OpenAiChatOptions
): Promise<OpenAiChatCompletion | null> {
  const client = getOpenAIClient()
  if (!client) return null

  const useVision =
    options.vision ||
    options.model?.includes("llama-4-scout") ||
    options.model?.includes("qwen/qwen3") ||
    /gpt-4o|gpt-4\.1|^o[34]/i.test(options.model ?? "")
  const messages = useVision
    ? capVisionImagesInMessages(options.messages, GROQ_VISION_MAX_IMAGES)
    : options.messages

  const primaryModel =
    options.model &&
    !options.model.startsWith("llama") &&
    !options.model.startsWith("meta-llama") &&
    !options.model.startsWith("qwen/")
      ? options.model
      : useVision
        ? OPENAI_VISION_FALLBACK_MODEL
        : OPENAI_TEXT_FALLBACK_MODEL

  const timeoutMs = options.timeoutMs ?? OPENAI_CHAT_TIMEOUT_MS
  const request = (model: string, fallbackUsed: boolean) =>
    meterModelCall({
      provider: "openai",
      modelRequested: model,
      fallbackUsed,
      call: () =>
        client.chat.completions.create(
          {
            model,
            messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
            temperature: options.temperature ?? 0.2,
            max_tokens: options.max_tokens,
            response_format: options.response_format,
          },
          { timeout: timeoutMs, maxRetries: 1 }
        ),
      extract: (completion) => ({ modelUsed: completion.model, usage: completion.usage }),
    })

  const toResult = (
    completion: Awaited<ReturnType<typeof request>>,
    modelRequested: string,
    modelSent: string,
    fallbackUsed: boolean
  ): OpenAiChatCompletion => ({
    text: completion.choices[0]?.message?.content?.trim() ?? null,
    modelRequested,
    modelUsed: completion.model?.trim() || modelSent,
    fallbackUsed,
    usage: normalizeUsage(completion.usage),
  })

  try {
    return toResult(await request(primaryModel, false), primaryModel, primaryModel, false)
  } catch (err) {
    const fallback = useVision ? OPENAI_VISION_FALLBACK_MODEL : OPENAI_TEXT_FALLBACK_MODEL
    if (primaryModel === fallback) throw err
    console.log("[openai-chat-fallback]", {
      result: "model_retry",
      primaryModel,
      fallback,
      error: err instanceof Error ? err.message : String(err),
    })
    return toResult(await request(fallback, true), primaryModel, fallback, true)
  }
}

export async function openaiChatText(options: OpenAiChatOptions): Promise<string | null> {
  const completion = await openaiChatCompletion(options)
  return completion ? completion.text : null
}

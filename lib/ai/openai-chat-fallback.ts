import OpenAI from "openai"
import type Groq from "groq-sdk"

import { capVisionImagesInMessages, GROQ_VISION_MAX_IMAGES } from "@/lib/ai/groq-vision"

export const OPENAI_TEXT_FALLBACK_MODEL =
  process.env.OPENAI_FALLBACK_MODEL?.trim() || "gpt-4o-mini"
export const OPENAI_VISION_FALLBACK_MODEL =
  process.env.OPENAI_VISION_FALLBACK_MODEL?.trim() || "gpt-4o-mini"

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return null
  return new OpenAI({ apiKey: key })
}

export type OpenAiChatOptions = {
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[]
  model?: string
  temperature?: number
  max_tokens?: number
  response_format?: { type: "json_object" }
  vision?: boolean
}

export function hasOpenAiFallback(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

export async function openaiChatText(options: OpenAiChatOptions): Promise<string | null> {
  const client = getOpenAIClient()
  if (!client) return null

  const useVision =
    options.vision ||
    options.model?.includes("llama-4-scout") ||
    /gpt-4o|gpt-4\.1|^o[34]/i.test(options.model ?? "")
  const messages = useVision
    ? capVisionImagesInMessages(options.messages, GROQ_VISION_MAX_IMAGES)
    : options.messages

  const completion = await client.chat.completions.create({
    model:
      options.model && !options.model.startsWith("llama") && !options.model.startsWith("meta-llama")
        ? options.model
        : useVision
          ? OPENAI_VISION_FALLBACK_MODEL
          : OPENAI_TEXT_FALLBACK_MODEL,
    messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens,
    response_format: options.response_format,
  })

  return completion.choices[0]?.message?.content?.trim() ?? null
}

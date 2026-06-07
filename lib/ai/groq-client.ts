import Groq from "groq-sdk"

import {
  capVisionImagesInMessages,
  GROQ_VISION_MAX_IMAGES,
  isGroqRateLimitError,
  normalizeGroqClientError,
} from "@/lib/ai/groq-vision"

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

export async function groqChatText(options: GroqChatOptions): Promise<string | null> {
  const groq = createGroqClient()
  if (!groq) return null

  const messages =
    options.vision || options.model === GROQ_VISION_MODEL
      ? capVisionImagesInMessages(options.messages, GROQ_VISION_MAX_IMAGES)
      : options.messages

  try {
    const completion = await groq.chat.completions.create({
      model: options.model ?? (options.vision ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL),
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens,
      response_format: options.response_format,
    })

    return completion.choices[0]?.message?.content?.trim() ?? null
  } catch (err: unknown) {
    throw normalizeGroqClientError(err)
  }
}

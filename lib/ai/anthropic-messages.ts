import { AnthropicError } from "@/lib/ai/anthropic-client"

/**
 * Anthropic Messages API with vision + prompt caching (fetch, no SDK).
 * Used by the taxonomy classifier: the static taxonomy block is cached, the product (title + photo) is not.
 */

export type AnthropicContentBlock =
  | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }
  | { type: "image"; source: { type: "url"; url: string } }

export type AnthropicSystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } }

/** Most capable vision model for product recognition — overridable without a deploy. */
export const ANTHROPIC_CLASSIFIER_MODEL = process.env.ANTHROPIC_CLASSIFIER_MODEL?.trim() || "claude-sonnet-5"

export function hasAnthropicClassifier(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

export async function anthropicMessagesText(args: {
  system: AnthropicSystemBlock[]
  content: AnthropicContentBlock[]
  model?: string
  maxTokens?: number
  timeoutMs?: number
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new AnthropicError("ANTHROPIC_API_KEY is not set")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 25_000)
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: args.model ?? ANTHROPIC_CLASSIFIER_MODEL,
        max_tokens: args.maxTokens ?? 1200,
        system: args.system,
        messages: [{ role: "user", content: args.content }],
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new AnthropicError(`Anthropic ${res.status}: ${body.slice(0, 300)}`, res.status)
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
    const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("")
    if (!text.trim()) throw new AnthropicError("Anthropic returned an empty response")
    return text
  } finally {
    clearTimeout(timer)
  }
}

/** Extract the first JSON object of a model answer (tolerates fences and chatter around it). */
export function parseJsonObject<T = unknown>(raw: string): T | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

import { groqChatText, GROQ_VISION_MODEL, isGroqRateLimitError } from "@/lib/ai/groq-client"
import type { AnthropicContentBlock, AnthropicSystemBlock } from "@/lib/ai/anthropic-messages"

/**
 * Groq-backed "model call" for the taxonomy classifier (same contract as `anthropicMessagesText`).
 *
 * Why it exists: when Anthropic is unavailable (no credit, bad key, outage) the old fallback was a lexical
 * keyword engine, which cannot understand an English title ("Action Figure") against a French taxonomy and
 * invented categories instead. The identify → choose pipeline is model-agnostic, so it now also runs on Groq.
 *
 * Operational reality it is built around (measured on the account): every Groq model is capped at 8 000 tokens
 * PER MINUTE. So calls are direct (no SDK backoff that turns a 429 into a 30 s hang, no dead OpenAI fallback), and
 * a rate-limited model is swapped for its sibling — each model has its own budget.
 */

const PRIMARY_TEXT_MODEL = process.env.GROQ_TAXONOMY_MODEL?.trim() || "openai/gpt-oss-120b"
/** Sibling with an independent token budget, tried when the primary is rate limited. */
const SIBLING_TEXT_MODEL = PRIMARY_TEXT_MODEL === "openai/gpt-oss-20b" ? "openai/gpt-oss-120b" : "openai/gpt-oss-20b"

export function hasGroqTaxonomyEngine(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim())
}

type GroqTaxonomyCallArgs = {
  system: AnthropicSystemBlock[]
  content: AnthropicContentBlock[]
  model?: string
  maxTokens?: number
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 12_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`groq_taxonomy_timeout_${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export function splitTaxonomyContent(args: Pick<GroqTaxonomyCallArgs, "system" | "content">): {
  system: string
  text: string
  imageUrls: string[]
} {
  const system = args.system.map((b) => b.text).join("\n\n")
  const text = args.content
    .filter((b): b is Extract<AnthropicContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
  const imageUrls = args.content
    .filter((b): b is Extract<AnthropicContentBlock, { type: "image" }> => b.type === "image")
    .map((b) => b.source.url)
    .filter((u) => /^https?:\/\//i.test(u))
  return { system, text, imageUrls }
}

export async function groqTaxonomyCall(args: GroqTaxonomyCallArgs): Promise<string> {
  const { system, text, imageUrls } = splitTaxonomyContent(args)
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const once = async (model: string, vision: boolean): Promise<string> => {
    const raw = await withTimeout(
      groqChatText({
        model,
        vision,
        direct: true,
        temperature: 0.1,
        max_tokens: args.maxTokens ?? 900,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: vision
              ? [
                  { type: "text" as const, text },
                  ...imageUrls.slice(0, 1).map((url) => ({ type: "image_url" as const, image_url: { url } })),
                ]
              : text,
          },
        ],
      }),
      timeoutMs
    )
    if (!raw?.trim()) throw new Error("groq_taxonomy_empty_response")
    return raw
  }

  /** Text model → its sibling when rate limited (separate token budgets). Anything else is a real failure. */
  const text2 = async (): Promise<string> => {
    const first = args.model ?? PRIMARY_TEXT_MODEL
    try {
      return await once(first, false)
    } catch (error) {
      if (!isGroqRateLimitError(error)) throw error
      console.warn("[groq-taxonomy]", { event: "rate_limited_switch_model", from: first, to: SIBLING_TEXT_MODEL })
      return once(first === SIBLING_TEXT_MODEL ? PRIMARY_TEXT_MODEL : SIBLING_TEXT_MODEL, false)
    }
  }

  if (imageUrls.length === 0) return text2()
  try {
    return await once(GROQ_VISION_MODEL, true)
  } catch (error) {
    // A photo Groq cannot fetch/decode (or a rate-limited vision model) must not cost the whole classification:
    // the title still carries signal.
    console.warn("[groq-taxonomy]", {
      event: "vision_failed_retry_text_only",
      message: error instanceof Error ? error.message.slice(0, 160) : String(error),
    })
    return text2()
  }
}

/**
 * Minimal Anthropic Messages API client (fetch, no SDK dependency).
 * Opt-in: only used when ANTHROPIC_API_KEY is set. Callers must fall back to another provider on error.
 */
export const ANTHROPIC_TEXT_MODEL = process.env.ANTHROPIC_TEXT_MODEL?.trim() || "claude-haiku-4-5-20251001"

export function hasAnthropicApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

export class AnthropicError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = "AnthropicError"
  }
}

export async function anthropicChatText(args: {
  system?: string
  user: string
  maxTokens?: number
  temperature?: number
  model?: string
  timeoutMs?: number
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) throw new AnthropicError("ANTHROPIC_API_KEY is not set")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 20_000)
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: args.model ?? ANTHROPIC_TEXT_MODEL,
        max_tokens: args.maxTokens ?? 900,
        temperature: args.temperature ?? 0.25,
        ...(args.system ? { system: args.system } : {}),
        messages: [{ role: "user", content: args.user }],
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      content?: Array<{ type?: string; text?: string }>
      error?: { type?: string; message?: string }
    }
    if (!res.ok) {
      throw new AnthropicError(`${data.error?.type ?? "error"}: ${String(data.error?.message ?? res.statusText).slice(0, 200)}`, res.status)
    }
    return (data.content ?? []).map((c) => (c.type === "text" ? c.text ?? "" : "")).join("").trim()
  } catch (e) {
    if (e instanceof AnthropicError) throw e
    throw new AnthropicError(e instanceof Error && e.name === "AbortError" ? "timeout" : e instanceof Error ? e.message : String(e))
  } finally {
    clearTimeout(timer)
  }
}

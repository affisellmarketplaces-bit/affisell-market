import type Groq from "groq-sdk"

/** BytePlus ModelArk AP — Dola Seed 2.0 Mini (descriptions produit). */
export const BYTEPLUS_LLM_MODEL =
  process.env.BYTEPLUS_LLM_MODEL?.trim() || "dola-seed-2-0-mini"

const DEFAULT_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3"

export function getBytePlusApiKey(): string | null {
  const key = process.env.BYTEPLUS_API_KEY?.trim() || process.env.ARK_API_KEY?.trim()
  return key || null
}

export function getBytePlusBaseUrl(): string {
  return (process.env.BYTEPLUS_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "")
}

export function hasBytePlusChat(): boolean {
  return Boolean(getBytePlusApiKey())
}

export type BytePlusChatOptions = {
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[]
  model?: string
  temperature?: number
  max_tokens?: number
  response_format?: { type: "json_object" }
}

type BytePlusErrorBody = {
  error?: { code?: string; message?: string }
  message?: string
}

function extractBytePlusError(body: unknown): string {
  if (!body || typeof body !== "object") return String(body ?? "Unknown error")
  const record = body as BytePlusErrorBody
  if (record.error?.message) {
    const code = record.error.code ? `${record.error.code} — ` : ""
    return `${code}${record.error.message}`
  }
  if (record.message) return record.message
  try {
    return JSON.stringify(body)
  } catch {
    return "Unknown error"
  }
}

export class BytePlusChatError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "BytePlusChatError"
    this.status = status
  }
}

/** OpenAI-compatible chat/completions on ModelArk (ap-southeast-1). */
export async function byteplusChatText(options: BytePlusChatOptions): Promise<string | null> {
  const apiKey = getBytePlusApiKey()
  if (!apiKey) return null

  const baseUrl = getBytePlusBaseUrl()
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? BYTEPLUS_LLM_MODEL,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens,
      response_format: options.response_format,
    }),
  })

  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }

  if (!res.ok) {
    throw new BytePlusChatError(res.status, extractBytePlusError(body))
  }

  const parsed = body as { choices?: Array<{ message?: { content?: string | null } }> }
  return parsed.choices?.[0]?.message?.content?.trim() ?? null
}

import { GoogleGenerativeAI } from "@google/generative-ai"

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash"

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim()
  return key || null
}

export function hasGeminiApiKey(): boolean {
  return Boolean(getGeminiApiKey())
}

const DEFAULT_GEMINI_TIMEOUT_MS = 5_000

/**
 * Gemini is the first hop of every text LLM call (see llm-router) with Groq as the fallback. When
 * Gemini was overloaded (503 "high demand") it held the request for ~15 s before the fallback ran,
 * past Vercel's 10 s /api cap — the user got an HTML error page instead of JSON. Bounding it keeps
 * the worst case at ~timeout + one fast Groq call.
 */
export function geminiTimeoutMs(): number {
  const n = Number(process.env.GEMINI_TIMEOUT_MS)
  return Number.isFinite(n) && n >= 1_000 ? n : DEFAULT_GEMINI_TIMEOUT_MS
}

export async function geminiChatText(prompt: string, system?: string): Promise<string> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY")
  }

  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel(
    {
      model: GEMINI_MODEL,
      ...(system ? { systemInstruction: system } : {}),
    },
    { timeout: geminiTimeoutMs() }
  )

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  console.log("[gemini-client]", { event: "Gemini", model: GEMINI_MODEL })
  return text
}

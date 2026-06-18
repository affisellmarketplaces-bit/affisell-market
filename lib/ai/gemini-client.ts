import { GoogleGenerativeAI } from "@google/generative-ai"

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash"

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim()
  return key || null
}

export function hasGeminiApiKey(): boolean {
  return Boolean(getGeminiApiKey())
}

export async function geminiChatText(prompt: string, system?: string): Promise<string> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY")
  }

  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    ...(system ? { systemInstruction: system } : {}),
  })

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  console.log("[gemini-client]", { event: "Gemini", model: GEMINI_MODEL })
  return text
}
